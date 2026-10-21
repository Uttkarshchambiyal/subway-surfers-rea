package com.railrush.game

import android.content.Context
import android.graphics.BitmapFactory
import android.opengl.GLES20.*
import android.opengl.GLSurfaceView
import android.opengl.GLUtils
import android.opengl.Matrix
import android.util.Log
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.*

/** Native GLES renderer for byte-backed APK geometry and baked recovered skin clips. */
class RailRenderer(private val context:Context,private val engine:Engine):GLSurfaceView.Renderer {
    var skin="coral";var onFrame:(()->Unit)?=null
    fun emit(name:String) {if(name=="coin"&&magnetWeight>0)magnetPulse=1f}
    private val manifest=JSONObject(context.assets.open("recovered/native/render.json").bufferedReader().use{it.readText()})
    private val data=context.assets.open("recovered/native/render.bin").use{it.readBytes()}.let{bytes->ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.LITTLE_ENDIAN).apply{put(bytes);rewind()}}
    private val textureIds=HashMap<String,Int>();private val prefabs=HashMap<String,List<Batch>>()
    private data class Batch(val buffer:Int,val count:Int,val texture:Int,val additive:Boolean,val tint:FloatArray)
    private data class CharacterMesh(val vertices:Int,val count:Int,val vbo:Int,val ebo:Int,val uv:FloatArray,val work:FloatBuffer)
    private val character=ArrayList<CharacterMesh>();private val outfits=HashMap<String,Int>()
    private val projection=FloatArray(16);private val view=FloatArray(16);private val vp=FloatArray(16);private val model=FloatArray(16);private val mvp=FloatArray(16)
    private var program=0;private var pos=0;private var uv=0;private var matrix=0;private var tintUniform=0;private var clock=0.0;private var last=0L;private var clipName="";private var clipStarted=0.0
    private var magnetWeight=0f;private var magnetPulse=0f;private val magnetMount=FloatArray(3);private var trailVbo=0;private var whiteTexture=0
    private val lineWork=ByteBuffer.allocateDirect(65*20).order(ByteOrder.nativeOrder()).asFloatBuffer()
    private var frameCount=0;private var perfStarted=0L
    private val scale=manifest.getDouble("unitScale").toFloat();private val segmentLength=180*scale
    private val camera=JSONObject(context.assets.open("config/gameplay.json").bufferedReader().use{it.readText()}).getJSONObject("camera")
    private fun bufferId():Int {val a=IntArray(1);glGenBuffers(1,a,0);return a[0]}
    private fun floats(offset:Int,count:Int):FloatBuffer {val b=data.duplicate().order(ByteOrder.LITTLE_ENDIAN);b.position(offset);b.limit(offset+count*4);return b.slice().order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()}
    private fun texture(path:String):Int=textureIds.getOrPut(path){val id=IntArray(1);glGenTextures(1,id,0);glBindTexture(GL_TEXTURE_2D,id[0]);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_CLAMP_TO_EDGE);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);val bitmap=context.assets.open(path).use{BitmapFactory.decodeStream(it)}?:error("Missing texture $path");GLUtils.texImage2D(GL_TEXTURE_2D,0,bitmap,0);bitmap.recycle();id[0]}
    private fun path(raw:String)="recovered/"+raw.removePrefix("../")
    private fun shader(type:Int,source:String):Int {val id=glCreateShader(type);glShaderSource(id,source);glCompileShader(id);val status=IntArray(1);glGetShaderiv(id,GL_COMPILE_STATUS,status,0);check(status[0]!=0){glGetShaderInfoLog(id)};return id}
    override fun onSurfaceCreated(gl:GL10?,config:EGLConfig?) {
        glClearColor(.447f,.776f,.984f,1f);glEnable(GL_DEPTH_TEST);glDisable(GL_CULL_FACE);textureIds.clear();prefabs.clear();character.clear();outfits.clear()
        program=glCreateProgram();glAttachShader(program,shader(GL_VERTEX_SHADER,"precision highp float; attribute vec3 p; attribute vec2 uv; uniform mat4 m; varying vec2 tex; varying float fog; void main(){gl_Position=m*vec4(p,1.0);tex=uv;fog=clamp((gl_Position.w-83.2)/82.0,0.0,1.0);}"));glAttachShader(program,shader(GL_FRAGMENT_SHADER,"precision mediump float; uniform sampler2D atlas; uniform vec4 tint; varying vec2 tex; varying float fog; void main(){vec4 c=texture2D(atlas,tex)*tint;if(c.a<0.05)discard;gl_FragColor=vec4(mix(c.rgb,vec3(.49,.698,.878),fog),c.a);}"));glLinkProgram(program);val status=IntArray(1);glGetProgramiv(program,GL_LINK_STATUS,status,0);check(status[0]!=0){glGetProgramInfoLog(program)}
        pos=glGetAttribLocation(program,"p");uv=glGetAttribLocation(program,"uv");matrix=glGetUniformLocation(program,"m");tintUniform=glGetUniformLocation(program,"tint");glUseProgram(program);glUniform1i(glGetUniformLocation(program,"atlas"),0)
        val environment=manifest.getJSONObject("environment")
        environment.keys().forEach {name->val batches=environment.getJSONObject(name).getJSONArray("batches");prefabs[name]=(0 until batches.length()).map{i->val b=batches.getJSONObject(i);val id=bufferId();glBindBuffer(GL_ARRAY_BUFFER,id);glBufferData(GL_ARRAY_BUFFER,b.getInt("bytes"),floats(b.getInt("offset"),b.getInt("bytes")/4),GL_STATIC_DRAW);Batch(id,b.getInt("vertices"),texture(path(b.getString("texture"))),b.optString("blend")=="add",FloatArray(4){b.getJSONArray("color").getDouble(it).toFloat()})}}
        val meshes=manifest.getJSONObject("character").getJSONArray("meshes")
        for(i in 0 until meshes.length()){val m=meshes.getJSONObject(i);val count=m.getInt("vertices");val uvArray=FloatArray(count*2);floats(m.getJSONObject("uv").getInt("offset"),count*2).get(uvArray);val e=m.getJSONObject("indices");val ebo=bufferId();glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,ebo);val slice=data.duplicate();slice.position(e.getInt("offset"));slice.limit(e.getInt("offset")+e.getInt("bytes"));glBufferData(GL_ELEMENT_ARRAY_BUFFER,e.getInt("bytes"),slice.slice(),GL_STATIC_DRAW);val vbo=bufferId();glBindBuffer(GL_ARRAY_BUFFER,vbo);glBufferData(GL_ARRAY_BUFFER,count*20,null,GL_DYNAMIC_DRAW);character.add(CharacterMesh(count,m.getInt("indexCount"),vbo,ebo,uvArray,ByteBuffer.allocateDirect(count*20).order(ByteOrder.nativeOrder()).asFloatBuffer()))}
        for((key,n)in listOf("coral" to 0,"mint" to 1,"violet" to 2))outfits[key]=texture("recovered/character/jake_outfit${n}_tex.png")
        trailVbo=bufferId();val white=IntArray(1);glGenTextures(1,white,0);whiteTexture=white[0];glBindTexture(GL_TEXTURE_2D,whiteTexture);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);val pixel=ByteBuffer.allocateDirect(4).put(byteArrayOf(-1,-1,-1,-1));pixel.rewind();glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA,1,1,0,GL_RGBA,GL_UNSIGNED_BYTE,pixel)
        last=0;perfStarted=System.nanoTime();Log.i("RailRushRecovered","loaded ${prefabs.size} original prefabs, ${manifest.getJSONObject("character").getJSONObject("clips").length()} clips")
    }
    override fun onSurfaceChanged(gl:GL10?,w:Int,h:Int){glViewport(0,0,w,h);Matrix.perspectiveM(projection,0,if(w>h)48f else camera.getDouble("verticalFov").toFloat(),w.toFloat()/h,.1f,240f)}
    private fun transform(x:Float,y:Float,z:Float,sx:Float=1f,sy:Float=1f,sz:Float=1f,rotation:Float=0f){Matrix.setIdentityM(model,0);Matrix.translateM(model,0,x,y,z);if(rotation!=0f)Matrix.rotateM(model,0,rotation,0f,1f,0f);Matrix.scaleM(model,0,sx,sy,sz);Matrix.multiplyMM(mvp,0,vp,0,model,0);glUniformMatrix4fv(matrix,1,false,mvp,0)}
    private fun bind(vbo:Int,texture:Int){glBindBuffer(GL_ARRAY_BUFFER,vbo);glVertexAttribPointer(pos,3,GL_FLOAT,false,20,0);glEnableVertexAttribArray(pos);glVertexAttribPointer(uv,2,GL_FLOAT,false,20,12);glEnableVertexAttribArray(uv);glBindTexture(GL_TEXTURE_2D,texture)}
    private fun draw(name:String,x:Float=0f,y:Float=0f,z:Float=0f,sx:Float=1f,sy:Float=1f,sz:Float=1f,rotation:Float=0f){transform(x,y,z,sx,sy,sz,rotation);for(b in prefabs[name].orEmpty()){if(b.additive){glEnable(GL_BLEND);glBlendFunc(GL_ONE,GL_ONE);glDepthMask(false)}else{glDisable(GL_BLEND);glDepthMask(true)};glUniform4fv(tintUniform,1,b.tint,0);bind(b.buffer,b.texture);glDrawArrays(GL_TRIANGLES,0,b.count)}}
    private fun entity(kind:String,x:Float,y:Float,z:Float,length:Float,size:Float=1f,turn:Float=(clock*110).toFloat()){
        val name=when(kind){"train"->"IrelandSpring_Train_Static_1_Subway";"movingTrain"->"IrelandSpring_Train_Moving_3_Standard";"ramp"->"IrelandSpring_Train_Ramp";"barrier"->"IrelandSpring_blocker_jump";"overhead"->"IrelandSpring_blocker_roll";"coin"->"currency_coin";"magnet"->"powerups_coinMagnet";"boots"->"powerups_superSneakers";"multiplier"->"powerups_2xMultiplier";"jetpack"->"Jetpack_Prop";"board"->"board_default";else->return}
        val bounds=manifest.getJSONObject("environment").getJSONObject(name);val min=bounds.getJSONArray("min");val max=bounds.getJSONArray("max");val width=(max.getDouble(0)-min.getDouble(0)).toFloat();val height=(max.getDouble(1)-min.getDouble(1)).toFloat();val depth=(max.getDouble(2)-min.getDouble(2)).toFloat()
        if(kind in listOf("coin","magnet","boots","multiplier","jetpack","board")){val s=(if(kind=="coin").74f else 1.05f)*size/max(width,height);draw(name,x-(max.getDouble(0)+min.getDouble(0)).toFloat()*.5f*s,y-(max.getDouble(1)+min.getDouble(1)).toFloat()*.5f*s,z,s,s,s,turn)}
        else{val h=when(kind){"barrier"->1.05f;"overhead"->2.6f;else->3f};val len=when(kind){"train","movingTrain"->10f;"ramp"->7f;"overhead"->1.4f;else->.7f};draw(name,x,y-min.getDouble(1).toFloat()*h/height,z-max.getDouble(2).toFloat()*len/depth,1f,h/height,len/depth)}
    }
    private fun drawCharacter(menu:Boolean){
        val e=engine;val name=when {menu->"Jake_Breathe";e.mode==Mode.COLLISION||e.mode==Mode.RESULTS->"death_lower";e.mode==Mode.STARTING->"introRun";e.roll>0->"roll";!e.grounded&&e.vy>2->"jump";!e.grounded->"hangtime";else->"RunNormal"}
        if(name!=clipName){clipName=name;clipStarted=clock};val clip=manifest.getJSONObject("character").getJSONObject("clips").getJSONObject(name);val duration=clip.getDouble("duration");val loop=name=="Jake_Breathe"||name=="RunNormal"||name=="hangtime";var time=(clock-clipStarted)*(if(name=="RunNormal")e.speed/e.tuning.initialSpeed else 1.0);time=if(loop)time%duration else min(time,duration);val frame=time/duration*(clip.getInt("frames")-1);val a=frame.toInt();val b=min(a+1,clip.getInt("frames")-1);val u=(frame-a).toFloat()
        val posed=manifest.getJSONObject("character").getJSONObject("clips").optJSONObject(name+"__magnet")
        val mounts=clip.getJSONArray("magnetMount");val posedMounts=posed?.getJSONArray("magnetMount")
        for(axis in 0..2){val regular=mounts.getJSONArray(a).getDouble(axis)*(1-u)+mounts.getJSONArray(b).getDouble(axis)*u;val raised=if(posedMounts!=null)posedMounts.getJSONArray(a).getDouble(axis)*(1-u)+posedMounts.getJSONArray(b).getDouble(axis)*u else regular;magnetMount[axis]=(regular+(raised-regular)*magnetWeight).toFloat()}
        glDisable(GL_BLEND);glDepthMask(true);glUniform4f(tintUniform,1f,1f,1f,1f);transform(e.x.toFloat()+if(menu).75f else 0f,e.y.toFloat(),0f,rotation=if(menu)157.08f else 0f)
        for((i,m)in character.withIndex()){val offset=clip.getJSONArray("meshes").getJSONObject(i).getInt("offset");val po=posed?.getJSONArray("meshes")?.getJSONObject(i)?.getInt("offset")?:0;m.work.clear();for(v in 0 until m.vertices){for(axis in 0..2){val va=data.getFloat(offset+(a*m.vertices*3+v*3+axis)*4);val vb=data.getFloat(offset+(b*m.vertices*3+v*3+axis)*4);var value=va+(vb-va)*u
                    if(posed!=null&&magnetWeight>0){val pa=data.getFloat(po+(a*m.vertices*3+v*3+axis)*4);val pb=data.getFloat(po+(b*m.vertices*3+v*3+axis)*4);value+=(pa+(pb-pa)*u-value)*magnetWeight};m.work.put(value)};m.work.put(m.uv[v*2]).put(m.uv[v*2+1])};m.work.flip();glBindBuffer(GL_ARRAY_BUFFER,m.vbo);glBufferSubData(GL_ARRAY_BUFFER,0,m.vertices*20,m.work);bind(m.vbo,outfits[skin]?:outfits.getValue("coral"));glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,m.ebo);glDrawElements(GL_TRIANGLES,m.count,GL_UNSIGNED_SHORT,0)}
    }
    private fun flightPoint(f:CoinFlight,elapsed:Double,target:FloatArray):FloatArray {
        val t=(elapsed/f.duration).coerceIn(0.0,1.0);val u=t*t*(3-2*t);val arc=sin(PI*u)
        return floatArrayOf((f.x+(target[0]-f.x)*u+arc*sign(f.x-target[0])*.22).toFloat(),(f.y+(target[1]-f.y)*u+arc*.85).toFloat(),(f.z+(target[2]-f.z)*u).toFloat())
    }
    private fun line(points:List<FloatArray>,alpha:Float,ribbon:Boolean=false){
        val vertices=if(ribbon)points.flatMapIndexed{i,p->val other=points[if(i==points.lastIndex)i-1 else i+1];val dx=p[0]-other[0];val dy=p[1]-other[1];val dz=p[2]-other[2];val px=dy-dz*.5f;val py= -dx;val pz=dx*.5f;val factor=.04f*(1-i.toFloat()/points.size)/max(.0001f,sqrt(px*px+py*py+pz*pz));listOf(floatArrayOf(p[0]+px*factor,p[1]+py*factor,p[2]+pz*factor),floatArrayOf(p[0]-px*factor,p[1]-py*factor,p[2]-pz*factor))}else points
        lineWork.clear();vertices.forEach{p->lineWork.put(p[0]).put(p[1]).put(p[2]).put(0f).put(0f)};lineWork.flip()
        transform(0f,0f,0f);glEnable(GL_BLEND);glBlendFunc(GL_SRC_ALPHA,GL_ONE);glDepthMask(false);glUniform4f(tintUniform,1f,.91f,.56f,alpha);glBindBuffer(GL_ARRAY_BUFFER,trailVbo);glBufferData(GL_ARRAY_BUFFER,vertices.size*20,lineWork,GL_DYNAMIC_DRAW);bind(trailVbo,whiteTexture);glLineWidth(2f);glDrawArrays(if(ribbon)GL_TRIANGLE_STRIP else GL_LINE_STRIP,0,vertices.size);glDepthMask(true)
    }
    override fun onDrawFrame(gl:GL10?){val now=System.nanoTime();val dt=if(last==0L)0.0 else min(.05,(now-last)/1e9);last=now;synchronized(engine){engine.frame(dt);val e=engine;val menu=e.mode==Mode.MENU;val animating=e.mode==Mode.RUNNING||e.mode==Mode.COLLISION
        val holding=!menu&&e.mode!=Mode.STARTING&&(e.powers.getValue("magnet")>0||e.entities.any{!it.used&&it.attraction!=null})
        if(menu||e.mode==Mode.STARTING)magnetWeight=0f else if(animating)magnetWeight=(magnetWeight+(if(holding)1f else -1f)*dt.toFloat()*5).coerceIn(0f,1f)
        if(animating)magnetPulse=max(0f,magnetPulse-dt.toFloat()*4)
        if(menu||e.mode==Mode.RUNNING||e.mode==Mode.STARTING||e.mode==Mode.COLLISION)clock+=dt;glClear(GL_COLOR_BUFFER_BIT or GL_DEPTH_BUFFER_BIT);glUseProgram(program);glActiveTexture(GL_TEXTURE0);val lift=e.y*(if(e.powers.getValue("jetpack")>0||e.y>3).82 else .12)
        if(menu)Matrix.setLookAtM(view,0,4.8f,3.5f,5.8f,-.7f,2.1f,0f,0f,1f,0f)else Matrix.setLookAtM(view,0,(e.x*.75).toFloat(),(camera.getDouble("y")+lift).toFloat(),camera.getDouble("z").toFloat(),(e.x*.55).toFloat(),(camera.getDouble("lookY")+lift).toFloat(),camera.getDouble("lookZ").toFloat(),0f,1f,0f);Matrix.multiplyMM(vp,0,projection,0,view,0)
        for(i in 0..7){val z=((e.distance+i*segmentLength)%(8*segmentLength)-7*segmentLength).toFloat();for(lane in -1..1)draw("track_4",lane*e.tuning.laneWidth.toFloat(),0f,z);val level=listOf("high","med","low","med")[i%4];val variant=if(level=="low")1 else i%3+1;for(side in listOf("left","right"))draw("IrelandSpring_${level}_0${variant}_$side",z=z)}
        if(menu)draw("IrelandSpring_Train_Start",x=-e.tuning.laneWidth.toFloat(),z=3f)
        for(item in e.entities)if(!item.used&&item.attraction==null){val z=(e.distance-item.z+item.movement).toFloat();if(z in -200f..20f)entity(item.kind,item.lane*e.tuning.laneWidth.toFloat(),item.y.toFloat(),z,item.length.toFloat())}
        if(e.powers.getValue("board")>0)draw("board_default",e.x.toFloat(),e.y.toFloat()-.1f,0f)
        if(!menu&&e.powers.getValue("jetpack")>0)draw("Jetpack_Prop",e.x.toFloat(),e.y.toFloat()+.9f,.25f,.6f,.6f,.6f)
        drawCharacter(menu)
        val mount=floatArrayOf(e.x.toFloat()+magnetMount[0],e.y.toFloat()+magnetMount[1],magnetMount[2]);val target=mount.copyOf();target[1]+=.23f
        if(magnetWeight>.01f){entity("magnet",mount[0],mount[1],mount[2],0f,.74f,-7f);val radius=.49f*(1+sin(clock*7).toFloat()*.08f+magnetPulse*.32f);line((0..48).map{i->val angle=i*2*PI/48;floatArrayOf(mount[0]+cos(angle).toFloat()*radius,mount[1]+sin(angle).toFloat()*radius,mount[2]-.04f)},.15f+magnetPulse*.6f)}
        for(item in e.entities)if(!item.used){val f=item.attraction?:continue;val point=flightPoint(f,f.elapsed,target);val u=(f.elapsed/f.duration).coerceIn(0.0,1.0);entity("coin",point[0],point[1],point[2],0f,(1-.72*u.pow(8)).toFloat(),(clock*1000).toFloat());line((0..8).map{i->flightPoint(f,max(0.0,f.elapsed-i*.012),target)},min(1.0,f.elapsed*12).toFloat()*.65f,true)}
        val error=glGetError();if(error!=GL_NO_ERROR)Log.e("RailRushRecovered","GL error $error")
        frameCount++;if(now-perfStarted>5_000_000_000){Log.i("RailRushRecovered","fps=${frameCount*1e9/(now-perfStarted)} animation=$clipName");frameCount=0;perfStarted=now}}
        onFrame?.invoke()
    }
}
