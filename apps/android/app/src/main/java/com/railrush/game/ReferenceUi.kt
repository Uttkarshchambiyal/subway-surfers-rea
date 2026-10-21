package com.railrush.game

import android.content.Context
import android.graphics.*
import android.view.View

/** Original native typography and meters arranged from the recorded reference composition. */
class GraffitiTitle(context:Context):View(context){
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG).apply{typeface=Typeface.create("sans-serif-condensed",Typeface.BOLD_ITALIC);textAlign=Paint.Align.CENTER}
    override fun onDraw(canvas:Canvas){super.onDraw(canvas);val w=width.toFloat();val h=height.toFloat();canvas.save();canvas.rotate(-7f,w*.5f,h*.5f);paint.textSize=w*.20f
        for((i,line)in listOf("SUBWAY","SURFERS").withIndex()){val y=h*.40f+i*paint.textSize*.86f;paint.shader=null;paint.style=Paint.Style.STROKE;paint.strokeJoin=Paint.Join.ROUND;paint.strokeWidth=w*.032f;paint.color=Color.rgb(43,61,96);canvas.drawText(line,w*.5f,y+5,paint);paint.strokeWidth=w*.012f;paint.color=Color.WHITE;canvas.drawText(line,w*.5f,y,paint);paint.style=Paint.Style.FILL;paint.shader=LinearGradient(0f,y-paint.textSize,0f,y,intArrayOf(Color.rgb(255,252,89),Color.rgb(255,211,35),Color.rgb(244,111,34)),null,Shader.TileMode.CLAMP);canvas.drawText(line,w*.5f,y,paint)};paint.shader=null;canvas.restore()}
}
class PowerMeters(context:Context):View(context){
    private val paint=Paint(Paint.ANTI_ALIAS_FLAG);private val values=DoubleArray(5);private val keys=arrayOf("magnet","jetpack","boots","multiplier","board");private val symbols=arrayOf("∩","↑","⇧","2×","▰");private val durations=doubleArrayOf(12.0,10.0,12.0,12.0,20.0)
    fun update(powers:Map<String,Double>){for(i in keys.indices)values[i]=powers[keys[i]]?:0.0;invalidate()}
    override fun onDraw(c:Canvas){val density=resources.displayMetrics.density;val pad=10*density;val gap=9*density;val width=(width-pad*2-gap)/2;val row=42*density;var slot=0;for(i in keys.indices){if(values[i]<=0)continue;val x=pad+(slot%2)*(width+gap);val y=height-(slot/2+1)*row;slot++;paint.color=Color.WHITE;c.drawRoundRect(x,y,x+width,y+34*density,7*density,7*density,paint);paint.color=Color.rgb(49,70,123);c.drawRoundRect(x+2*density,y+2*density,x+width-2*density,y+32*density,6*density,6*density,paint);paint.color=Color.rgb(78,153,220);c.drawRoundRect(x+4*density,y+4*density,x+32*density,y+30*density,4*density,4*density,paint);paint.color=Color.YELLOW;paint.textSize=20*density;paint.typeface=Typeface.DEFAULT_BOLD;paint.textAlign=Paint.Align.CENTER;c.drawText(symbols[i],x+18*density,y+25*density,paint);val meterX=x+38*density;val meterW=width-45*density;val filled=(values[i]/durations[i]*10).toInt().coerceIn(0,10);for(b in 0..9){paint.color=if(b<filled)Color.rgb(240,239,34)else Color.rgb(101,110,139);val bx=meterX+b*meterW/10;c.drawRect(bx,y+8*density,bx+meterW/10-3*density,y+27*density,paint)}}}
}
