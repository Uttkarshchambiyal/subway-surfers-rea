package com.railrush.game

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import java.io.File

/** Synthetic native GLES fixture; captures real rendered coin travel. */
class MagnetSmoke:Instrumentation(){
    private lateinit var activity:MainActivity
    private lateinit var engine:Engine
    private val checks=ArrayList<String>()
    override fun onCreate(arguments:Bundle?){super.onCreate(arguments);start()}
    private fun check(name:String,condition:Boolean){if(!condition)throw AssertionError(name);checks.add(name)}
    private fun capture(name:String){uiAutomation.takeScreenshot()?.let{bitmap->File(targetContext.filesDir,"magnet-$name.png").outputStream().use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}}}
    override fun onStart(){val result=Bundle();try{
        activity=startActivitySync(Intent(targetContext,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as MainActivity
        val field=MainActivity::class.java.getDeclaredField("engine");field.isAccessible=true;engine=field.get(activity) as Engine
        SystemClock.sleep(800)
        runOnMainSync{synchronized(engine){engine.start();engine.tick(.8);engine.entities.clear();engine.powers["magnet"]=12.0}}
        SystemClock.sleep(600);capture("held")
        synchronized(engine){for(lane in -1..1){val coin=Entity();coin.set(Template("magnet-test-$lane","coin",lane,engine.distance+6,.9,.5),0,engine.tuning.routeCycle);engine.entities.add(coin)}}
        SystemClock.sleep(100);synchronized(engine){check("coins remain visible before arrival",engine.coins==0&&engine.entities.count{it.attraction!=null}==3)};capture("launch")
        SystemClock.sleep(100);synchronized(engine){engine.pause()};capture("curve-paused")
        val progress=synchronized(engine){engine.entities.filter{it.attraction!=null}.map{it.attraction!!.elapsed}}
        SystemClock.sleep(200);synchronized(engine){check("pause freezes native coin flight",progress==engine.entities.filter{it.attraction!=null}.map{it.attraction!!.elapsed});engine.resume();engine.move(1);engine.jump();engine.powers["magnet"]=0.0}
        SystemClock.sleep(110);capture("moving-hand");SystemClock.sleep(800)
        synchronized(engine){check("all three lanes credit once after expiry",engine.coins==3);check("native coin flights cleaned",engine.entities.none{it.attraction!=null});engine.powers["magnet"]=12.0;engine.down()};SystemClock.sleep(100);capture("roll")
        synchronized(engine){engine.powers["jetpack"]=10.0};SystemClock.sleep(800);capture("jetpack")
        synchronized(engine){engine.start();check("restart clears magnet and flights",engine.coins==0&&engine.powers.getValue("magnet")==0.0&&engine.entities.none{it.attraction!=null})}
        val report="{\"pass\":true,\"checks\":"+checks.joinToString(",","[","]"){"\"$it\""}+",\"scope\":\"Synthetic route coins in native Android emulator GLES renderer; no physical-device claim\"}"
        File(targetContext.filesDir,"magnet-verification.json").writeText(report);result.putString("report",report);finish(Activity.RESULT_OK,result)
    }catch(error:Throwable){File(targetContext.filesDir,"magnet-failure.txt").writeText(checks.joinToString("\n")+"\n"+error.stackTraceToString());result.putString("error",error.stackTraceToString());finish(Activity.RESULT_CANCELED,result)}}
}
