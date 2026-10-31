package br.com.gestorpro.monitor
import android.content.Context
import androidx.work.*
import java.util.Calendar
import java.util.concurrent.TimeUnit

class MonitorWorker(ctx:Context,params:WorkerParameters):Worker(ctx,params) {
 override fun doWork():Result {
  val prefs=applicationContext.getSharedPreferences("gp_sync",Context.MODE_PRIVATE)
  if(!Api.signed(applicationContext))return Result.success()
  prefs.edit().putString("run_state","running").putLong("run_started",System.currentTimeMillis())
   .putInt("run_done",0).putInt("run_total",2).putString("last_error","").apply()
  return try {
   Api.readTotals(applicationContext) { finished ->
    prefs.edit().putInt("run_done",finished).apply()
   }
   prefs.edit().putString("run_state","success").putLong("run_finished",System.currentTimeMillis()).apply()
   Result.success()
  } catch(e:Exception) {
   prefs.edit().putString("run_state","failed").putLong("run_finished",System.currentTimeMillis())
    .putString("last_error",e.message?.take(240) ?: "Erro desconhecido").apply()
   Result.retry()
  }
 }
 companion object {
  private const val NAME="gestor_pro_monitor_daily"
  private const val OLD="gestor_pro_monitor_360"
  private val hours=intArrayOf(0,6,12,18)
  fun nextTime(now:Long=System.currentTimeMillis()):Long {
   val clock=Calendar.getInstance().apply {timeInMillis=now}
   val options=hours.map { h ->
    (clock.clone() as Calendar).apply {
     set(Calendar.HOUR_OF_DAY,h);set(Calendar.MINUTE,0);set(Calendar.SECOND,0);set(Calendar.MILLISECOND,0)
     if(timeInMillis<=now)add(Calendar.DAY_OF_YEAR,1)
    }.timeInMillis
   }
   return options.minOrNull()!!
  }
  fun schedule(ctx:Context){
   val manager=WorkManager.getInstance(ctx)
   manager.cancelUniqueWork(OLD)
   val delay=(nextTime()-System.currentTimeMillis()).coerceAtLeast(0)
   val req=PeriodicWorkRequestBuilder<MonitorWorker>(6,TimeUnit.HOURS)
    .setInitialDelay(delay,TimeUnit.MILLISECONDS)
    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,TimeUnit.MINUTES).build()
   manager.enqueueUniquePeriodicWork(NAME,ExistingPeriodicWorkPolicy.KEEP,req)
  }
  fun stop(ctx:Context){val m=WorkManager.getInstance(ctx);m.cancelUniqueWork(NAME);m.cancelUniqueWork(OLD)}
 }
}