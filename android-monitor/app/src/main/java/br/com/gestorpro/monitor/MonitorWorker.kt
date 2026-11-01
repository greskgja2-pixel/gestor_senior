package br.com.gestorpro.monitor
import android.content.Context
import androidx.work.*
import java.util.Calendar
import java.util.concurrent.TimeUnit

class MonitorWorker(ctx:Context,params:WorkerParameters):Worker(ctx,params) {
 override fun doWork():Result {
  val ctx=applicationContext
  if(!Api.signed(ctx)||!enabled(ctx))return Result.success()
  val prefs=ctx.getSharedPreferences("gp_sync",Context.MODE_PRIVATE)
  prefs.edit().putString("run_state","running").putLong("run_started",System.currentTimeMillis())
   .putInt("run_done",0).putInt("run_total",2).putString("last_error","").apply()
  try {
   Api.readTotals(ctx){n->prefs.edit().putInt("run_done",n).apply()}
   prefs.edit().putString("run_state","success").putLong("run_finished",System.currentTimeMillis()).apply()
  }catch(e:Exception){
   prefs.edit().putString("run_state","failed").putLong("run_finished",System.currentTimeMillis())
    .putString("last_error",e.message?.take(240) ?: "Erro desconhecido").apply()
  }finally{schedule(ctx)}
  return Result.success()
 }
 companion object {
  private const val NAME="gestor_pro_monitor_custom"
  private const val OLD="gestor_pro_monitor_360"
  private const val OLD_DAILY="gestor_pro_monitor_daily"
  private const val PREFS="gp_schedule"
  private const val DEFAULT="00:00,06:00,12:00,18:00"
  fun enabled(ctx:Context)=ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean("enabled",true)
  fun hours(ctx:Context):List<String> = ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE)
    .getString("times",DEFAULT)!!.split(",").filter {Regex("([01][0-9]|2[0-3]):[0-5][0-9]").matches(it)}.distinct().sorted()
  fun save(ctx:Context,values:List<String>,active:Boolean){
   require(values.isNotEmpty()){"Adicione pelo menos um horário"}
   require(values.all{Regex("([01][0-9]|2[0-3]):[0-5][0-9]").matches(it)}){"Horário inválido"}
   ctx.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().putString("times",values.distinct().sorted().joinToString(",")).putBoolean("enabled",active).apply()
   schedule(ctx)
  }
  fun nextTime(ctx:Context,now:Long=System.currentTimeMillis()):Long {
   val clock=Calendar.getInstance().apply{timeInMillis=now}
   return hours(ctx).map{value->
    val parts=value.split(":")
    (clock.clone() as Calendar).apply{
     set(Calendar.HOUR_OF_DAY,parts[0].toInt());set(Calendar.MINUTE,parts[1].toInt())
     set(Calendar.SECOND,0);set(Calendar.MILLISECOND,0)
     if(timeInMillis<=now)add(Calendar.DAY_OF_YEAR,1)
    }.timeInMillis
   }.minOrNull() ?: 0L
  }
  @Synchronized fun schedule(ctx:Context){
   val manager=WorkManager.getInstance(ctx)
   manager.cancelUniqueWork(OLD);manager.cancelUniqueWork(OLD_DAILY)
   if(!enabled(ctx)||!Api.signed(ctx)){manager.cancelUniqueWork(NAME);return}
   val delay=(nextTime(ctx)-System.currentTimeMillis()).coerceAtLeast(0L)
   val req=OneTimeWorkRequestBuilder<MonitorWorker>()
     .setInitialDelay(delay,TimeUnit.MILLISECONDS)
     .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
     .build()
   manager.enqueueUniqueWork(NAME,ExistingWorkPolicy.REPLACE,req)
  }
  fun stop(ctx:Context){
   val m=WorkManager.getInstance(ctx)
   m.cancelUniqueWork(NAME);m.cancelUniqueWork(OLD);m.cancelUniqueWork(OLD_DAILY)
  }
 }
}