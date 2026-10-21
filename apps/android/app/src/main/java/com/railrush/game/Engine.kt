package com.railrush.game

import kotlin.math.*

data class Tuning(val fixed:Double=1.0/120, val laneWidth:Double=3.888888888888889, val laneSeconds:Double=.27, val initialSpeed:Double=21.38888888888889, val maxSpeed:Double=42.77777777777778, val acceleration:Double=.11949099937926753, val gravity:Double=38.88888888888889, val jump:Double=17.391639824998364, val superJump:Double=24.59549291242073,
    val jetpackLaneSeconds:Double=.54, val minimumLaneTravel:Double=.2916666666666667, val jumpGrace:Double=.15, val diveVelocity:Double=-17.5, val rollSeconds:Double=.6, val routeCycle:Double=6144.0, val generationAhead:Double=300.0, val despawnBehind:Double=24.0,
    val playerRadius:Double=.36, val collisionHalfWidth:Double=1.46, val coinHalfWidth:Double=.65, val coinHalfDepth:Double=.7, val coinHalfHeight:Double=.85, val standingHeight:Double=1.75, val rollingHeight:Double=.65,
    val magnetSeconds:Double=12.0, val jetpackSeconds:Double=10.0, val bootsSeconds:Double=12.0, val multiplierSeconds:Double=12.0, val boardSeconds:Double=20.0, val jetpackHeight:Double=8.0, val jetpackSmoothing:Double=6.0, val landingGrace:Double=1.5, val boardGrace:Double=1.0, val magnetRadius:Double=10.5, val magnetFlightBase:Double=.34, val magnetFlightPerUnit:Double=.02) {
    fun duration(kind:String)=when(kind){"magnet"->magnetSeconds;"jetpack"->jetpackSeconds;"boots"->bootsSeconds;"multiplier"->multiplierSeconds;"board"->boardSeconds;else->0.0}
    companion object {
        fun fromJson(raw:String):Tuning {
            fun n(key:String)=Regex("\"$key\"\\s*:\\s*(-?[0-9.eE+]+)").find(raw)?.groupValues?.get(1)?.toDouble()?:error("Missing gameplay value $key")
            return Tuning(n("fixedStep"),n("laneWidth"),n("laneChangeSeconds"),n("initialSpeed"),n("maxSpeed"),n("acceleration"),n("gravity"),n("jumpVelocity"),n("superJumpVelocity"),n("jetpackLaneChangeSeconds"),n("minimumLaneChangeTravel"),n("groundedJumpGraceSeconds"),n("diveVelocity"),n("rollSeconds"),n("routeCycleLength"),n("generationAhead"),n("despawnBehind"),n("playerRadius"),n("collisionHalfWidth"),n("coinPickupHalfWidth"),n("coinPickupHalfDepth"),n("coinPickupHalfHeight"),n("standingHeight"),n("rollingHeight"),n("magnetSeconds"),n("jetpackSeconds"),n("bootsSeconds"),n("multiplierSeconds"),n("boardSeconds"),n("jetpackHeight"),n("jetpackSmoothing"),n("landingGraceSeconds"),n("boardGraceSeconds"),n("magnetAttractionRadius"),n("magnetFlightBaseSeconds"),n("magnetFlightSecondsPerUnit"))
        }
    }
}
data class Template(val id:String,val kind:String,val lane:Int,val z:Double,val y:Double,val length:Double)
data class CoinFlight(var elapsed:Double,val duration:Double,val x:Double,val y:Double,val z:Double)
class Entity { var attraction:CoinFlight?=null; var id=""; var kind=""; var lane=0; var z=0.0; var y=0.0; var length=1.0; var movement=0.0; var used=false; fun set(t:Template,cycle:Int,cycleLength:Double){id=t.id+":"+cycle;kind=t.kind;lane=t.lane;z=t.z+cycle*cycleLength; y=t.y;length=t.length;movement=0.0;used=false;attraction=null} }
enum class Mode { MENU, STARTING, RUNNING, PAUSED, COLLISION, RESULTS }
class Engine(val tuning:Tuning=Tuning(), val route:List<Template> = emptyList()) {
    var mode=Mode.MENU; private set
    var previousMode=Mode.RUNNING
    var x=0.0; var y=0.0; var vy=0.0; var lane=0
    var distance=0.0; var speed=tuning.initialSpeed; var elapsed=0.0
    var distanceScore=0; var coins=0; var roll=0.0; var grace=0.0; var stageTime=0.0; var boards=3
    val powers=linkedMapOf("magnet" to 0.0,"jetpack" to 0.0,"boots" to 0.0,"multiplier" to 0.0,"board" to 0.0)
    val entities=ArrayList<Entity>(256); private val pool=ArrayDeque<Entity>(512)
    private var next=0; private var cycle=0; private var acc=0.0; private var laneFrom=0.0; private var laneT=1.0; var floor=0.0
    var grounded=true; var groundedAgo=0.0; private var laneDuration=tuning.laneSeconds; private var laneTravel=0.0; private var lastLaneDistance=Double.NEGATIVE_INFINITY
    var settled=false; var onEvent:((String)->Unit)?=null
    val score:Int get()=distanceScore+coins*10
    init { repeat(512){pool.add(Entity())} }
    fun start(){ entities.forEach{pool.add(it)};entities.clear();next=0;cycle=0;acc=0.0;laneFrom=0.0;laneT=1.0;x=0.0;y=0.0;vy=0.0;lane=0;distance=0.0;speed=tuning.initialSpeed;elapsed=0.0;distanceScore=0;coins=0;roll=0.0;grace=0.0;floor=0.0;grounded=true;groundedAgo=0.0;laneDuration=tuning.laneSeconds;lastLaneDistance=Double.NEGATIVE_INFINITY;laneTravel=0.0;settled=false;powers.keys.toList().forEach{powers[it]=0.0};mode=Mode.STARTING;stageTime=.8;spawn() }
    fun pause(){if(mode==Mode.RUNNING||mode==Mode.STARTING){previousMode=mode;mode=Mode.PAUSED;acc=0.0}}
    fun resume(){if(mode==Mode.PAUSED){mode=previousMode;acc=0.0}}
    fun menu(){mode=Mode.MENU;acc=0.0}
    fun move(dir:Int){if(mode!=Mode.RUNNING)return;val changing=laneT<1.0;if(changing&&((lane*tuning.laneWidth-laneFrom)*dir>=0||laneTravel<tuning.minimumLaneTravel))return;var target=if(changing)Math.rint(x/tuning.laneWidth).toInt() else Math.rint(x/tuning.laneWidth).toInt()+dir;if(changing&&Math.rint(laneFrom/tuning.laneWidth).toInt()!=target)target+=dir;if(target !in -1..1||abs(target*tuning.laneWidth-x)<1e-9)return;lastLaneDistance=distance;laneDuration=(if(powers.getValue("jetpack")>0)tuning.jetpackLaneSeconds else tuning.laneSeconds)/max(1.0,speed/tuning.initialSpeed)*(if(changing)abs(target-x/tuning.laneWidth)else 1.0);lane=target;laneFrom=x;laneT=0.0;laneTravel=0.0}
    fun jump(){if(mode!=Mode.RUNNING||powers.getValue("jetpack")>0)return;if(grounded||groundedAgo<tuning.jumpGrace){grounded=false;groundedAgo=100.0;vy=if(powers.getValue("boots")>0)tuning.superJump else tuning.jump;roll=0.0;onEvent?.invoke("jump")}}
    fun down(){if(mode!=Mode.RUNNING||powers.getValue("jetpack")>0)return;roll=tuning.rollSeconds;if(!grounded)vy=min(vy,tuning.diveVelocity);onEvent?.invoke("roll")}
    fun board(){if(mode==Mode.RUNNING && powers.getValue("board")<=0 && boards>0){boards--;powers["board"]=tuning.boardSeconds;onEvent?.invoke("power")}}
    fun frame(delta:Double){if(mode==Mode.MENU||mode==Mode.PAUSED||mode==Mode.RESULTS)return;acc+=delta.coerceIn(0.0,.05);while(acc>=tuning.fixed){tick(tuning.fixed);acc-=tuning.fixed}}
    private fun advanceAttractions(dt:Double){
        entities.forEach{e->val f=e.attraction;if(!e.used&&f!=null){f.elapsed+=dt;if(f.elapsed>=f.duration){e.used=true;e.attraction=null;coins++;onEvent?.invoke("coin")}}}
    }
    fun tick(dt:Double=tuning.fixed){
        if(mode==Mode.STARTING||mode==Mode.COLLISION){if(mode==Mode.COLLISION)advanceAttractions(dt);stageTime-=dt;if(stageTime<=0)mode=if(mode==Mode.STARTING)Mode.RUNNING else Mode.RESULTS;return}
        if(mode!=Mode.RUNNING)return
        advanceAttractions(dt)
        val oldD=distance;val oldY=y;groundedAgo=if(grounded)0.0 else groundedAgo+dt;speed=min(tuning.maxSpeed,speed+tuning.acceleration*dt);distance+=speed*dt;elapsed+=dt
        laneT=min(1.0,laneT+dt/laneDuration);val s=laneT;val oldX=x;x=laneFrom+(lane*tuning.laneWidth-laneFrom)*s;laneTravel+=abs(x-oldX)
        roll=max(0.0,roll-dt);grace=max(0.0,grace-dt)
        powers.keys.forEach{ k -> val old=powers.getValue(k);powers[k]=max(0.0,old-dt);if(k=="jetpack"&&old>0&&powers.getValue(k)==0.0){grace=tuning.landingGrace;vy=0.0;grounded=false} }
        entities.forEach{if(it.kind=="movingTrain")it.movement+=4*dt}
        floor=0.0
        if(powers.getValue("jetpack")<=0)entities.forEach{ e->
            if(!e.used&&abs(x-e.lane*tuning.laneWidth)<=1.1){val z=e.z-e.movement;val rel=distance-z
                if(e.kind=="ramp"&&rel>=0&&rel<=e.length){floor=max(floor,3*min(1.0,(rel+tuning.playerRadius)/e.length))}
                if((e.kind=="train"||e.kind=="movingTrain")&&rel>=-.1&&rel<=e.length+.1&&oldY>=2.9){floor=max(floor,3.0)}
            }
        }
        if(powers.getValue("jetpack")>0){roll=0.0;y+=(tuning.jetpackHeight-y)*min(1.0,dt*tuning.jetpackSmoothing);vy=0.0;grounded=false;groundedAgo=100.0}else if(grounded&&y<=floor+.16){y=floor;vy=0.0}else {grounded=false;vy-=tuning.gravity*dt;y+=vy*dt;if(y<=floor&&vy<=0){y=floor;vy=0.0;grounded=true}}
        val body=y+if(roll>0).32 else .9;val height=if(roll>0)tuning.rollingHeight else tuning.standingHeight
        entities.forEach{e->if(!e.used){val z=e.z-e.movement;val ahead=z-distance;val side=abs(x-e.lane*tuning.laneWidth)
            if(e.kind=="coin") {
                if(e.attraction==null){
                    val range=hypot(side,ahead)
                    if(powers.getValue("magnet")>0&&range<tuning.magnetRadius&&abs(e.y-body)<4){e.attraction=CoinFlight(0.0,tuning.magnetFlightBase+range*tuning.magnetFlightPerUnit,e.lane*tuning.laneWidth,e.y,distance-e.z)}
                    else if(side<tuning.coinHalfWidth&&oldD-tuning.coinHalfDepth<=z&&z<=distance+tuning.coinHalfDepth&&abs(e.y-body)<tuning.coinHalfHeight){e.used=true;coins++;onEvent?.invoke("coin")}
                }
            }else if(e.kind in powers.keys){if(side<1&&oldD-1<=z&&z<=distance+1&&abs(e.y-body)<1.4){e.used=true;powers[e.kind]=tuning.duration(e.kind);onEvent?.invoke("power")}}
            else if(e.kind!="ramp"&&grace<=0&&powers.getValue("jetpack")<=0&&side<tuning.collisionHalfWidth){
                val sweptStart=min(oldD,distance);val occupied=sweptStart<=z+e.length+.32&&distance>=z-.32
                val hits=when(e.kind){"barrier"->y<1.05;"overhead"->y+height>1.1&&y<2.6;"train","movingTrain"->y<2.92;else->false}
                if(occupied&&hits){crash()}
            }
        }}
        distanceScore+=(kotlin.math.floor(distance)-kotlin.math.floor(oldD)).toInt()*3*(if(powers.getValue("multiplier")>0)2 else 1)
        for(i in entities.lastIndex downTo 0){val e=entities[i];if((e.attraction==null&&e.z-e.movement+e.length<distance-tuning.despawnBehind)||e.used){entities.removeAt(i);pool.add(e)}}
        if(mode==Mode.RUNNING)spawn()
    }
    private fun spawn(){if(route.isEmpty())return;while(route[next].z+cycle*tuning.routeCycle<=distance+tuning.generationAhead){val t=route[next];if(t.z+cycle*tuning.routeCycle>=distance-1){val e=if(pool.isNotEmpty())pool.removeFirst()else Entity();e.set(t,cycle,tuning.routeCycle);entities.add(e)};next++;if(next>=route.size){next=0;cycle++}}}
    fun crash(){if(mode!=Mode.RUNNING||grace>0||powers.getValue("jetpack")>0)return;if(powers.getValue("board")>0){powers["board"]=0.0;grace=tuning.boardGrace;entities.forEach{if(it.kind!="coin"&&abs(it.z-it.movement-distance)<16)it.used=true};onEvent?.invoke("shield")}else{mode=Mode.COLLISION;stageTime=.6;onEvent?.invoke("crash")}}
}
