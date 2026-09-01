package com.pygma

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import java.security.MessageDigest

class OtpRetrieverModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  private var receiver: BroadcastReceiver? = null

  override fun getName(): String = "PygmaOtpRetriever"

  @ReactMethod
  fun startListening(promise: Promise) {
    stopReceiver()
    receiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context, intent: Intent) {
        if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
        val status = intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
        if (status.statusCode == CommonStatusCodes.SUCCESS) {
          val message = intent.extras?.getString(SmsRetriever.EXTRA_SMS_MESSAGE).orEmpty()
          val otp = Regex("\\b(\\d{6})\\b").find(message)?.groupValues?.get(1)
          if (!otp.isNullOrEmpty()) {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit("PygmaOtpReceived", otp)
          }
        }
      }
    }

    ContextCompat.registerReceiver(
      context,
      receiver,
      IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION),
      ContextCompat.RECEIVER_EXPORTED
    )
    SmsRetriever.getClient(context).startSmsRetriever()
      .addOnSuccessListener { promise.resolve(true) }
      .addOnFailureListener { error -> promise.reject("E_SMS_RETRIEVER", error) }
  }

  @ReactMethod
  fun stopListening() {
    stopReceiver()
  }

  @ReactMethod
  fun getAppHash(promise: Promise) {
    try {
      val packageName = context.packageName
      val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = context.packageManager.getPackageInfo(
          packageName,
          PackageManager.GET_SIGNING_CERTIFICATES
        )
        val signingInfo = info.signingInfo
        if (signingInfo?.hasMultipleSigners() == true) {
          signingInfo.apkContentsSigners
        } else {
          signingInfo?.signingCertificateHistory.orEmpty()
        }
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES).signatures
      }
      val hash = signatures.firstOrNull()?.let { signature ->
        val input = "$packageName ${signature.toCharsString()}"
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        Base64.encodeToString(digest, Base64.NO_PADDING or Base64.NO_WRAP).take(11)
      }.orEmpty()
      promise.resolve(hash)
    } catch (error: Exception) {
      promise.reject("E_APP_HASH", error)
    }
  }

  @ReactMethod fun addListener(eventName: String) = Unit
  @ReactMethod fun removeListeners(count: Int) = Unit

  private fun stopReceiver() {
    receiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
      }
    }
    receiver = null
  }

  override fun invalidate() {
    stopReceiver()
    super.invalidate()
  }
}
