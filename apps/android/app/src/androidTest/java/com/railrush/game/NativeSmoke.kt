package com.railrush.game

import android.app.Instrumentation
import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.opengl.GLES20
import java.io.File
import kotlin.math.abs

/** Local debug instrumentation. Synthetic collision fixtures are labelled in its report. */
class NativeSmoke:Instrumentation() {
    private lateinit var activity:MainActivity
    private lateinit var e:Engine
    private val checks=ArrayList<String>()
    override fun onCreate(arguments:Bundle?){super.onCreate(arguments);start()}
    private fun check(name:String,ok:Boolean){if(!ok)throw AssertionError(name);checks.add(name);android.util.Log.i("RailRushTest","PASS: "+name)}
    private fun waitFor(ms:Long=450,predicate:()->Boolean={true}){val end=SystemClock.uptimeMillis()+ms;do{SystemClock.sleep(20)}while(SystemClock.uptimeMillis()<end&&!predicate());if(!predicate())throw AssertionError("wait condition")}
    private fun click(prefix:String){var found:Button?=null;runOnMainSync{fun visit(v:View){if(v is Button&&v.text.toString().startsWith(prefix))found=v;if(v is ViewGroup)for(i in 0 until v.childCount)visit(v.getChildAt(i))};visit(activity.window.decorView);check("button:$prefix",found!=null);found!!.performClick()};waitFor(100)}
    private fun swipe(dx:Float,dy:Float){val w=activity.resources.displayMetrics.widthPixels;val h=activity.resources.displayMetrics.heightPixels;val x=w*.5f;val y=h*.65f;val t=SystemClock.uptimeMillis();sendPointerSync(MotionEvent.obtain(t,t,MotionEvent.ACTION_DOWN,x,y,0));sendPointerSync(MotionEvent.obtain(t,t+100,MotionEvent.ACTION_UP,x+dx,y+dy,0));SystemClock.sleep(250)}
    private fun capture(name:String){SystemClock.sleep(350);uiAutomation.takeScreenshot()?.let{bitmap->java.io.FileOutputStream(File(targetContext.filesDir,"native-$name.png")).use{bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}}}
    private fun reset(){runOnMainSync{synchronized(e){e.start()}};waitFor(12000){e.mode==Mode.RUNNING}}
    override fun onStart(){val result=Bundle();try{
        activity=startActivitySync(Intent(targetContext,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as MainActivity
        val f=MainActivity::class.java.getDeclaredField("engine");f.isAccessible=true;e=f.get(activity) as Engine
        waitFor(8000){activity.hasWindowFocus()};SystemClock.sleep(400);capture("menu");click("Locker");click("Back");click("Missions");click("Back");click("⚙");click("Sound: on");click("Sound: muted");click("Back");click("Tap to Play");SystemClock.sleep(200);if(e.mode==Mode.PAUSED)click("Continue run");waitFor(12000){e.mode==Mode.RUNNING}
        val d=e.distance;SystemClock.sleep(400);check("native GL loop advances simulation",e.distance>d)
        swipe(180f,0f);waitFor(2000){e.x>2.5};check("right swipe changes lane",e.lane==1&&e.x>2.5);capture("right-lane");swipe(-180f,0f);waitFor(2000){abs(e.x)<.1};check("left swipe changes lane",e.lane==0&&abs(e.x)<.1)
        swipe(0f,-180f);waitFor(2000){e.y>.5};check("up swipe jumps",e.y>.5);SystemClock.sleep(700);swipe(0f,180f);check("down swipe rolls",e.roll>.1)
        runOnMainSync{synchronized(e){e.pause()}};val paused=e.distance;SystemClock.sleep(350);check("pause freezes distance",e.distance==paused);runOnMainSync{synchronized(e){e.resume()}};SystemClock.sleep(150);check("explicit resume advances",e.distance>paused)
        // Insert one actual route-format pickup just in front of the runner; GL thread collects it normally.
        for(kind in listOf("magnet","jetpack","boots","multiplier","board")){reset();synchronized(e){val pickup=Entity();pickup.set(Template("fixture-$kind",kind,0,e.distance+.6,.9,.5),0,e.tuning.routeCycle);e.entities.add(pickup)};waitFor(900){e.powers.getValue(kind)>0};check("synthetic pickup applies:$kind",e.powers.getValue(kind)>0);if(kind=="jetpack"){waitFor(6000){e.y>7};capture("jetpack")}else capture(kind)}
        reset();synchronized(e){e.board()};check("inventory board starts protection",e.powers.getValue("board")>19);synchronized(e){e.crash()};check("board negates crash",e.mode==Mode.RUNNING&&e.grace>0&&e.powers.getValue("board")==0.0)
        reset();synchronized(e){e.crash()};waitFor(18000){e.mode==Mode.RESULTS};SystemClock.sleep(150);check("collision reaches results",e.mode==Mode.RESULTS);click("Run again");waitFor(12000){e.mode==Mode.RUNNING};check("restart clears run coins",e.coins==0)
        // Lifecycle through Home and re-launch: explicit paused state is required.
        targetContext.startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));SystemClock.sleep(350);check("background automatically pauses",e.mode==Mode.PAUSED);val bg=e.distance;SystemClock.sleep(300);check("background time frozen",e.distance==bg)
        targetContext.startActivity(Intent(targetContext,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT))
        SystemClock.sleep(250);check("foreground remains paused",e.mode==Mode.PAUSED)
        val report="{\"status\":\"pass\",\"checks\":"+checks.joinToString(",","[","]"){"\"$it\""}+",\"scope\":\"native emulator UI, GL-thread simulation, synthetic route pickups; no physical device or acoustic output assertion\"}"
        File(targetContext.filesDir,"runtime-smoke.json").writeText(report);result.putString("report",report);finish(Activity.RESULT_OK,result)
    }catch(t:Throwable){File(targetContext.filesDir,"runtime-smoke-failure.txt").writeText(checks.joinToString("\n")+"\nFAILED: "+t.stackTraceToString());result.putString("error",t.stackTraceToString());finish(Activity.RESULT_CANCELED,result)}}
}
