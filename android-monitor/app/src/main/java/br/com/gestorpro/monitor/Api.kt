package br.com.gestorpro.monitor
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

object Api {
 private const val ROOT="https://raxhdrlnqkbqjpsbtgwf.supabase.co"
 private const val KEY="sb_publishable_Cdpn9B0B-bfj21koW2N9hA_33hOUOWs"
 private fun p(c:Context)=c.getSharedPreferences("gp_auth",Context.MODE_PRIVATE)
 private fun call(path:String,method:String="GET",jwt:String?=null,body:JSONObject?=null):String {
  val c=URL(ROOT+path).openConnection() as HttpURLConnection
  try {
   c.requestMethod=method;c.connectTimeout=15000;c.readTimeout=20000
   c.setRequestProperty("apikey",KEY);c.setRequestProperty("Content-Type","application/json")
   if(jwt!=null)c.setRequestProperty("Authorization","Bearer $jwt")
   if(body!=null){c.doOutput=true;c.outputStream.use{it.write(body.toString().toByteArray())}}
   val code=c.responseCode
   val response=(if(code in 200..299)c.inputStream else c.errorStream)?.bufferedReader()?.use{it.readText()} ?: ""
   if(code !in 200..299)throw IllegalStateException("HTTP $code: "+response.take(200))
   return response
  }finally{c.disconnect()}
 }
 fun signed(ctx:Context)=!p(ctx).getString("refresh",null).isNullOrBlank()
 fun signOut(ctx:Context){p(ctx).edit().clear().apply()}
 private fun save(ctx:Context,j:JSONObject){
  p(ctx).edit().putString("access",j.getString("access_token")).putString("refresh",j.getString("refresh_token"))
   .putLong("expiry",System.currentTimeMillis()+j.optLong("expires_in",3600)*1000-120000).apply()
 }
 fun signIn(ctx:Context,email:String,password:String){
  save(ctx,JSONObject(call("/auth/v1/token?grant_type=password","POST",body=JSONObject().put("email",email).put("password",password))))
 }
 @Synchronized private fun token(ctx:Context):String {
  if(!signed(ctx))throw IllegalStateException("Login necessário")
  if(System.currentTimeMillis()>=p(ctx).getLong("expiry",0)){
   val refresh=p(ctx).getString("refresh","") ?: ""
   save(ctx,JSONObject(call("/auth/v1/token?grant_type=refresh_token","POST",body=JSONObject().put("refresh_token",refresh))))
  }
  return p(ctx).getString("access","") ?: throw IllegalStateException("Sessão inválida")
 }
 data class Product(val id:String,val title:String,val active:Boolean,val image:String)
 fun products(ctx:Context):List<Product>{
  val t=token(ctx)
  val out=mutableListOf<Product>();var offset=0
  while(true){
   val arr=JSONArray(call("/rest/v1/produtos_monitorados?select=id,nome,ativo,imagem&order=criado_em.desc&limit=500&offset=$offset",jwt=t))
   for(i in 0 until arr.length()){val o=arr.getJSONObject(i);out.add(Product(o.getString("id"),o.optString("nome","Produto sem nome"),o.optBoolean("ativo",false),o.optString("imagem","")))}
   offset+=arr.length();if(arr.length()<500)break
  }
  return out
 }
 fun setProductActive(ctx:Context,id:String,active:Boolean){
  val safe=URLEncoder.encode(id,"UTF-8")
  call("/rest/v1/produtos_monitorados?id=eq.$safe","PATCH",token(ctx),JSONObject().put("ativo",active))
 }
 fun lastSync(ctx:Context)=ctx.getSharedPreferences("gp_sync",Context.MODE_PRIVATE).getLong("last_sync",0)
 fun readTotals(ctx:Context,onProgress:(Int)->Unit = {}):Pair<Int,Int> {
  val t=token(ctx)
  fun count(table:String):Int {
   var total=0;var offset=0
   while(true){
    val arr=JSONArray(call("/rest/v1/$table?select=id&ativo=eq.true&limit=500&offset=$offset",jwt=t))
    total+=arr.length();offset+=arr.length();if(arr.length()<500)break
   }
   return total
  }
  val product=count("produtos_monitorados");onProgress(1)
  val search=count("buscas_monitoradas");onProgress(2)
  ctx.getSharedPreferences("gp_sync",Context.MODE_PRIVATE).edit()
   .putInt("products",product).putInt("searches",search).putLong("last_sync",System.currentTimeMillis()).apply()
  return Pair(product,search)
 }
}