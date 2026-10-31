package br.com.gestorpro.monitor
import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class MonitorWorker(ctx:Context,params:WorkerParameters):Worker(ctx,params) {
 override fun doWork():Result {
  if(!Api.signed(applicationContext))return Result.success()
  return try { Api.readTotals(applicationContext); Result.success() }
  catch(e:Exception) {
   applicationContext.getSharedPreferences("gp_sync",Context.MODE_PRIVATE).edit().putString("last_error",e.message?.take(200)).apply()
   Result.retry()
  }
 }
 companion object {
  private const val NAME="gestor_pro_monitor_360"
  fun schedule(ctx:Context) {
   val w=PeriodicWorkRequestBuilder<MonitorWorker>(360,TimeUnit.MINUTES)
     .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
     .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,TimeUnit.MINUTES).build()
   WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(NAME,ExistingPeriodicWorkPolicy.KEEP,w)
  }
  fun stop(ctx:Context){WorkManager.getInstance(ctx).cancelUniqueWork(NAME)}
 }
}