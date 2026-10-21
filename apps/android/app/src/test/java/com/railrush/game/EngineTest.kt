package com.railrush.game
import org.junit.Assert.*
import org.junit.Test

class EngineTest {
    private val root=generateSequence(java.io.File(System.getProperty("user.dir")!!)){it.parentFile}.first{java.io.File(it,"shared/config/gameplay.json").exists()}
    private val tuning=Tuning.fromJson(java.io.File(root,"shared/config/gameplay.json").readText())
    private val vectors=java.io.File(root,"shared/test-vectors/physics.json").readText()
    private fun vector(section:String,key:String):Double {val body=Regex("\"$section\"\\s*:\\s*\\{([^}]+)\\}").find(vectors)!!.groupValues[1];return Regex("\"$key\"\\s*:\\s*(-?[0-9.eE+]+)").find(body)!!.groupValues[1].toDouble()}
    private fun running(route:List<Template> = emptyList())=Engine(tuning,route).also{it.start();it.tick(.8);assertEquals(Mode.RUNNING,it.mode)}
    @Test fun magnetFlightAcrossTracksPauseExpiryAndCollision(){
        val e=running();e.move(-1);repeat(40){e.tick()};e.powers["magnet"]=12.0
        val coin=Entity();coin.set(Template("cross","coin",1,e.distance+5,.9,.5),0,tuning.routeCycle);e.entities.add(coin);e.tick()
        assertNotNull(coin.attraction);assertEquals(0,e.coins);e.pause();val progress=coin.attraction!!.elapsed;repeat(100){e.tick()};assertEquals(progress,coin.attraction!!.elapsed,0.0)
        e.resume();e.powers["magnet"]=0.0;repeat(100){e.tick()};assertEquals(1,e.coins);repeat(100){e.tick()};assertEquals(1,e.coins)
        e.powers["magnet"]=12.0;val next=Entity();next.set(Template("crash","coin",1,e.distance+5,.9,.5),0,tuning.routeCycle);e.entities.add(next);e.tick();assertNotNull(next.attraction);e.crash();repeat(80){e.tick()};assertEquals(Mode.RESULTS,e.mode);assertEquals(2,e.coins)
        e.start();assertTrue(e.entities.none{it.attraction!=null});assertEquals(0,e.coins)
    }
    @Test fun nativeLaneReversal(){val e=running();e.move(1);e.tick(.01);e.move(-1);assertEquals(1,e.lane);e.tick(.08);val before=e.x;e.move(-1);assertEquals(0,e.lane);assertEquals(before,e.x,1e-9);e.tick(.10);assertEquals(0.0,e.x,1e-9)}
    @Test fun sharedTenSeconds(){val e=running();repeat(1200){e.tick()};assertEquals(vector("unimpeded10s","speed"),e.speed,1e-9);assertEquals(vector("unimpeded10s","distance"),e.distance,1e-8);assertEquals(vector("unimpeded10s","score").toInt(),e.score)}
    @Test fun sharedJump(){val e=running();e.jump();var ticks=0;var apex=0.0;do{e.tick();apex=maxOf(apex,e.y);ticks++}while(e.y>0&&ticks<500);assertEquals(vector("jump","landingSeconds"),ticks*tuning.fixed,1e-9);assertEquals(vector("jump","apex"),apex,1e-9)}
    @Test fun laneMidpointAndRedirect(){val e=running();e.move(1);e.tick(tuning.laneSeconds/2);assertEquals(vector("lane","midpointX"),e.x,1e-9);e.move(-1);e.tick(tuning.laneSeconds);assertEquals(0.0,e.x,1e-9);repeat(4){e.move(-1)};e.tick(tuning.laneSeconds);assertEquals(-tuning.laneWidth,e.x,1e-9)}
    @Test fun pauseHasNoTimeOrPowerCost(){val e=running();e.powers["magnet"]=12.0;e.tick();val d=e.distance;val p=e.powers.getValue("magnet");e.pause();repeat(2000){e.frame(.05)};assertEquals(d,e.distance,0.0);assertEquals(p,e.powers.getValue("magnet"),0.0);e.resume();e.tick();assertTrue(e.distance>d)}
    @Test fun sharedPowerExpiry(){val e=running();e.powers["magnet"]=12.0;repeat(1200){e.tick()};assertEquals(2.0,e.powers.getValue("magnet"),1e-9);repeat(241){e.tick()};assertEquals(0.0,e.powers.getValue("magnet"),0.0)}
    @Test fun boardProtectsOnce(){val e=running();e.board();assertEquals(2,e.boards);e.crash();assertEquals(Mode.RUNNING,e.mode);assertEquals(0.0,e.powers.getValue("board"),0.0);assertEquals(1.0,e.grace,0.0);repeat(121){e.tick()};e.crash();assertEquals(Mode.COLLISION,e.mode);e.tick(.6);assertEquals(Mode.RESULTS,e.mode)}
    @Test fun jetpackExpiryGrantsGrace(){val e=running();e.powers["jetpack"]=.1;repeat(14){e.tick()};assertEquals(0.0,e.powers.getValue("jetpack"),0.0);assertTrue(e.grace>1.4);assertTrue(e.y>0)}
    @Test fun coinAndBarrierCollision(){val e=running(listOf(Template("c","coin",0,1.0,.9,.1),Template("b","barrier",0,5.0,0.0,1.0)));while(e.mode==Mode.RUNNING&&e.distance<10){e.tick()};assertEquals(1,e.coins);assertEquals(Mode.COLLISION,e.mode)}
    @Test fun rollingPassesOverhead(){val e=running(listOf(Template("o","overhead",0,1.5,0.0,1.0)));e.down();repeat(40){e.tick()};assertEquals(Mode.RUNNING,e.mode)}
    @Test fun highSpeedSweptCollision(){val e=running(listOf(Template("b","barrier",0,.5,0.0,.1)));e.speed=26.0;e.tick(.05);assertEquals(Mode.COLLISION,e.mode)}
    @Test fun resetClearsAllRunState(){val e=running();e.powers["boots"]=12.0;e.coins=88;e.jump();repeat(50){e.tick()};e.start();assertEquals(0,e.coins);assertEquals(0.0,e.distance,0.0);assertEquals(0.0,e.y,0.0);assertTrue(e.entities.isEmpty());assertTrue(e.powers.values.all{it==0.0})}
    @Test fun rampReachesTrainRoof(){val e=running(listOf(Template("r","ramp",0,1.0,0.0,7.0),Template("t","train",0,8.0,0.0,10.0)));while(e.distance<10&&e.mode==Mode.RUNNING){e.tick()};assertEquals(Mode.RUNNING,e.mode);assertEquals(3.0,e.floor,1e-9);assertEquals(3.0,e.y,1e-9)}
    @Test fun bootsAndMultiplier(){val e=running();e.powers["boots"]=12.0;e.jump();var apex=0.0;repeat(130){e.tick();apex=maxOf(apex,e.y)};assertTrue(apex>1.9*vector("jump","apex"));e.distanceScore=600;e.coins=3;e.powers["multiplier"]=12.0;assertEquals(630,e.score)}
    @Test fun movingTrainApproaches(){val e=running(listOf(Template("m","movingTrain",1,40.0,0.0,10.0)));repeat(120){e.tick()};assertEquals(4.0,e.entities.first().movement,1e-8);assertEquals(Mode.RUNNING,e.mode)}
    @Test fun extendedBoundedPooling(){val route=(0..95).flatMap{i->listOf(Template("c$i","coin",1,96.0+i*64,.9,.1),Template("t$i","train",-1,96.0+i*64,0.0,10.0))};val e=running(route);var peak=0;repeat(144000){e.tick();peak=maxOf(peak,e.entities.size)};assertEquals(Mode.RUNNING,e.mode);assertTrue(e.distance>26000);assertTrue(peak<35);assertTrue(e.entities.size<35)}
    @Test fun multiplierExpiryNeverReducesScore(){val e=running();e.powers["multiplier"]=.1;var previous=e.score;repeat(1200){e.tick();assertTrue(e.score>=previous);previous=e.score};assertTrue(e.score>=372)}
    @Test fun referenceMovementSemantics(){
        val e=running();e.move(1);e.move(-1);assertEquals(1,e.lane);repeat(3){e.tick()};e.move(-1);assertEquals(0,e.lane)
        val jet=running();jet.powers["jetpack"]=10.0;jet.move(-1);jet.tick(tuning.jetpackLaneSeconds/2);assertEquals(-tuning.laneWidth/2,jet.x,1e-9)
        val airborne=running();airborne.grounded=false;airborne.groundedAgo=tuning.jumpGrace/2;airborne.y=.2;airborne.jump();assertEquals(tuning.jump,airborne.vy,0.0);airborne.tick();val firstVy=airborne.vy;airborne.jump();assertEquals(firstVy,airborne.vy,0.0);airborne.down();assertEquals(tuning.diveVelocity,airborne.vy,0.0);assertEquals(tuning.rollSeconds,airborne.roll,0.0)
        val expired=running();expired.grounded=false;expired.groundedAgo=tuning.jumpGrace;expired.y=.2;expired.jump();assertEquals(0.0,expired.vy,0.0)
        val boundary=running();boundary.move(1);boundary.tick(tuning.laneSeconds);boundary.move(1);boundary.move(-1);assertEquals(0,boundary.lane)
    }
    @Test fun routeRepeatsAtSharedCycle(){
        val e=running(listOf(Template("cycle","coin",1,96.0,.9,.1)));e.distance=tuning.routeCycle-200;e.tick();assertTrue(e.entities.any{it.id=="cycle:1"&&it.z==tuning.routeCycle+96})
    }
    @Test fun canonicalSharedRouteConformance(){
        var root=java.io.File(System.getProperty("user.dir")!!);while(!java.io.File(root,"shared/config/route.json").exists())root=root.parentFile?:error("workspace root")
        val raw=java.io.File(root,"shared/config/route.json").readText()
        val objects=Regex("""\{[^{}]+\}""").findAll(raw).map{it.value}.filter{it.contains("\"kind\"")}
        fun text(obj:String,key:String)=Regex(""""$key"\s*:\s*"([^"]+)"""").find(obj)!!.groupValues[1]
        fun num(obj:String,key:String)=Regex(""""$key"\s*:\s*(-?[0-9.]+)""").find(obj)!!.groupValues[1].toDouble()
        val route=objects.map{Template(num(it,"id").toInt().toString(),text(it,"kind"),num(it,"lane").toInt(),num(it,"z"),num(it,"y"),num(it,"length"))}.sortedBy{it.z}.toList()
        assertTrue(route.size>1000)
        val scenario=java.io.File(root,"shared/test-vectors/scenarios.json").readText()
        val actions=Regex("""\{\s*"tick"\s*:\s*(\d+),\s*"action"\s*:\s*"([^"]+)"\s*\}""").findAll(scenario).associate{it.groupValues[1].toInt() to it.groupValues[2]}
        val sampleBody=Regex(""""sampleTicks"\s*:\s*\[([^]]+)\]""").find(scenario)!!.groupValues[1]
        val samples=Regex("""\d+""").findAll(sampleBody).map{it.value.toInt()}.toSet()
        val e=running(route);val output=ArrayList<String>()
        repeat(2400){tick->when(val action=actions[tick]){"left"->e.move(-1);"right"->e.move(1);"jump"->e.jump();"roll"->e.down();null->{};else->e.powers[action]=tuning.duration(action)}
            e.grace=1.0;e.tick();if(tick+1 in samples){output.add("""{"tick":${tick+1},"distance":${e.distance},"speed":${e.speed},"x":${e.x},"y":${e.y},"coins":${e.coins},"score":${e.score},"""+e.powers.entries.joinToString(","){""""${it.key}":${it.value}"""}+"}")}}
        java.io.File(root,"outputs/android").mkdirs()
        java.io.File(root,"outputs/android/conformance.json").writeText("""{"scenario":"canonical-20s","samples":["""+output.joinToString(",")+"]}")
        assertEquals(7,output.size)
    }
}
