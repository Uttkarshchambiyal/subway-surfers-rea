"""Bounded route reachability model, parameterized by shared gameplay config.

The default mode checks full planner-step x/y envelopes. The coarse comparison
checks endpoint x/y only. Neither result is a continuous/game-engine proof.
"""
from pathlib import Path
import argparse
import bisect
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[1]
OBSTACLE_KINDS = {'barrier', 'overhead', 'train', 'movingTrain'}
# These collision/velocity constants currently live in engine.ts, not config.
MOVING_TRAIN_SPEED = 4.0
COLLISION_DEPTH = .32
BARRIER_TOP = 1.05
OVERHEAD_BOTTOM = 1.1
OVERHEAD_TOP = 2.6
TRAIN_TOP = 2.92


def audit(cycles=3, planner_ticks=10, coarse=False):
    config_path = ROOT / 'shared/config/gameplay.json'
    route_path = ROOT / 'shared/config/route.json'
    config = json.loads(config_path.read_text())
    route = json.loads(route_path.read_text())
    assert config['laneInterpolation'] == 'linear', 'Update model for new interpolation'
    assert route['cycleLength'] == config['routeCycleLength']
    h = config['fixedStep']
    dt = h * planner_ticks
    lane_steps = math.ceil(config['laneChangeSeconds'] / dt)
    # Shorter than actual roll even accounting for its first physics decrement.
    roll_steps = max(0, math.floor((config['rollSeconds'] - h) / dt))
    velocity, gravity = config['jumpVelocity'], config['gravity']
    jump_steps = math.ceil((2 * velocity / gravity - h) / dt) + 1
    target = route['cycleLength'] * cycles

    # Match engine's speed-before-distance semi-implicit integration exactly.
    distances = [0.0]
    speed = config['initialSpeed']
    while distances[-1] < target or (len(distances) - 1) % planner_ticks:
        speed = min(config['maxSpeed'], speed + config['acceleration'] * h)
        distances.append(distances[-1] + speed * h)
    obstacles = []
    for cycle in range(cycles + 1):
        for entity in route['entities']:
            if entity['kind'] not in OBSTACLE_KINDS:
                continue
            z = entity['z'] + cycle * route['cycleLength']
            # spawn() runs initially and after distance update; moving starts
            # on the following physics tick. No extra activation step is added.
            activation_tick = bisect.bisect_left(distances, max(0, z - config['generationAhead']))
            obstacles.append({**entity, 'z': z, 'cycle': cycle, 'activation': activation_tick})

    def jump_height(age):
        return max(0, velocity * age - .5 * gravity * age * age)

    def vertical_bounds(jump):
        # j=1 is a whole lag interval at ground level. After that the exact
        # semi-implicit trajectory lies between the padded lower parabola and
        # continuous upper parabola at aligned fixed-step boundaries.
        age0 = max(0, (jump - 2) * dt) if jump else 0
        age1 = max(0, (jump - 1) * dt) if jump else 0
        if coarse:
            height = max(0, jump_height(age1) - .5 * gravity * h * age1)
            return height, height
        low = max(0, min(jump_height(age0), jump_height(age1)) - .5 * gravity * h * age1)
        high = max(jump_height(age0), jump_height(age1))
        if age0 <= velocity / gravity <= age1:
            high = max(high, velocity * velocity / (2 * gravity))
        return low, high

    # Meaningful trajectory self-check: every fixed-step sample through the
    # modeled jump must lie within its containing planner envelope.
    if not coarse:
        y, vy = 0.0, velocity
        samples = [0.0]
        for tick in range(jump_steps * planner_ticks):
            vy -= gravity * h
            y = max(0, y + vy * h)
            samples.append(y)
            if y == 0:
                vy = 0
        for jump in range(2, jump_steps + 1):
            low, high = vertical_bounds(jump)
            for y in samples[(jump - 2) * planner_ticks:(jump - 1) * planner_ticks + 1]:
                assert low - 1e-9 <= y <= high + 1e-9
    assert roll_steps * dt <= config['rollSeconds'] - h + 1e-9
    assert planner_ticks * h * config['initialSpeed'] >= config['minimumLaneChangeTravel']

    # from lane, target lane, transition step (zero=standing), jump step,
    # roll steps (negative=one pending lag interval).
    states = {(0, 0, 0, 0, 0)}
    minimum, maximum, failure = math.inf, 0, None
    steps = 0
    for tick in range(planner_ticks, len(distances), planner_ticks):
        old_tick = tick - planner_ticks
        d0, d = distances[old_tick], distances[tick]
        threats = []
        for obstacle in obstacles:
            moving = obstacle['kind'] == 'movingTrain'
            z0 = obstacle['z'] - (MOVING_TRAIN_SPEED * h * max(0, old_tick - obstacle['activation']) if moving else 0)
            z = obstacle['z'] - (MOVING_TRAIN_SPEED * h * max(0, tick - obstacle['activation']) if moving else 0)
            if min(z - d, z0 - d0) <= COLLISION_DEPTH and max(z + obstacle['length'] - d, z0 + obstacle['length'] - d0) >= -COLLISION_DEPTH:
                threats.append((obstacle['lane'] * config['laneWidth'], obstacle['kind'], obstacle['id'], obstacle['cycle']))
        next_states = set()
        for source, target_lane, move, jump, roll in states:
            lanes = [(source, target_lane, move)] if move else [(target_lane, target_lane, 0)] + [(target_lane, target_lane + q, 1) for q in (-1, 1) if -1 <= target_lane + q <= 1]
            actions = [(jump, roll)]
            if not jump:
                actions.append((1, 0))
                if roll_steps:
                    actions.append((0, -roll_steps))
            for a, b, m in lanes:
                if m:
                    u0 = min(1, (m - 1) * dt / config['laneChangeSeconds'])
                    u1 = min(1, m * dt / config['laneChangeSeconds'])
                    old_x = (a + (b - a) * u0) * config['laneWidth']
                    x = (a + (b - a) * u1) * config['laneWidth']
                    nf, nt, nm = (b, b, 0) if m >= lane_steps else (a, b, m + 1)
                else:
                    x = old_x = b * config['laneWidth']
                    nf, nt, nm = b, b, 0
                xmin, xmax = (x, x) if coarse else (min(old_x, x), max(old_x, x))
                for j, r in actions:
                    low_y, high_y = vertical_bounds(j)
                    height = config['rollingHeight'] if r > 0 else config['standingHeight']
                    hit = any(
                        xmin - config['collisionHalfWidth'] < lane_x < xmax + config['collisionHalfWidth']
                        and (low_y < BARRIER_TOP if kind == 'barrier' else low_y < OVERHEAD_TOP and high_y + height > OVERHEAD_BOTTOM if kind == 'overhead' else low_y < TRAIN_TOP)
                        for lane_x, kind, _, _ in threats)
                    if not hit:
                        next_states.add((nf, nt, nm, j + 1 if j and j < jump_steps else 0, -r if r < 0 else max(0, r - 1)))
        states = next_states
        steps += 1
        minimum, maximum = min(minimum, len(states)), max(maximum, len(states))
        if not states:
            failure = {'time': tick * h, 'distance': d, 'threats': [{'laneX': x, 'kind': k, 'id': i, 'cycle': c} for x, k, i, c in threats]}
            break
    return {
        'pass': failure is None,
        'model': 'endpoint-comparison' if coarse else 'swept-envelope',
        'cycles': cycles,
        'targetDistance': route['cycleLength'] * cycles,
        'distanceAudited': distances[steps * planner_ticks],
        'timeAuditedSeconds': steps * dt,
        'plannerStepSeconds': dt,
        'actualLaneChangeSeconds': config['laneChangeSeconds'],
        'laneInterpolation': config['laneInterpolation'],
        'laneControlLockSeconds': lane_steps * dt,
        'actionLagSeconds': dt,
        'plannerRollSeconds': roll_steps * dt,
        'actualRollSeconds': config['rollSeconds'],
        'verticalSemiImplicitPaddingPerSecond': .5 * gravity * h,
        'minimumReachableStates': minimum,
        'maxReachableStates': maximum,
        'failure': failure,
        'physics': {key: config[key] for key in ('initialSpeed', 'maxSpeed', 'acceleration', 'fixedStep', 'laneWidth', 'gravity', 'jumpVelocity', 'generationAhead', 'collisionHalfWidth')},
        'engineConstants': {'movingTrainSpeed': MOVING_TRAIN_SPEED, 'collisionHalfDepth': COLLISION_DEPTH, 'barrierTop': BARRIER_TOP, 'overheadBottom': OVERHEAD_BOTTOM, 'overheadTop': OVERHEAD_TOP, 'trainTop': TRAIN_TOP},
        'inputsSha256': {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in (config_path, route_path)},
        'selfChecks': ['semi-implicit jump samples enclosed' if not coarse else 'endpoint comparison only', 'roll shorter than actual minus first decrement', 'action spacing meets minimum lane travel'],
        'boundary': 'Bounded recreation-only analytic model. Speed integration matches configured fixed steps; linear lane motion and moving-train activation use current config. Restricted action grid, one-step jump/roll lag, shortened rolls, and swept envelopes (except endpoint comparison mode) limit optimism. Ignores ramps, train-roof landing, powers, dive rolls, lane retargeting and entity pool behavior; these omissions can change trajectories. No predecessor witness is replayed in the engine. Pass is supporting bounded evidence, not a continuous-space guarantee or physical playtest; failure would not establish an impossible route.'
    }


def main(coarse=False):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cycles', type=int, default=3)
    parser.add_argument('--planner-ticks', type=int, default=10)
    args = parser.parse_args()
    if args.cycles < 1 or args.planner_ticks < 1:
        parser.error('cycles and planner-ticks must be positive')
    result = audit(args.cycles, args.planner_ticks, coarse)
    path = ROOT / ('outputs/route-validation-coarse.json' if coarse else 'outputs/route-validation.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    return int(not result['pass'])


if __name__ == '__main__':
    raise SystemExit(main())
