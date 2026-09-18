package com.pygma

import android.content.Intent
import android.content.ActivityNotFoundException
import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Opens Android's app chooser instead of silently using the device's default map app. */
class MapChooserModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = "PygmaMapChooser"

  @ReactMethod
  fun open(latitude: Double, longitude: Double, promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("E_MAP_ACTIVITY", "Unable to open maps right now.")
      return
    }

    val coordinates = "$latitude,$longitude"
    val mapIntent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:$coordinates?q=$coordinates"))
    try {
      activity.startActivity(Intent.createChooser(mapIntent, "Open with"))
      promise.resolve(null)
    } catch (error: ActivityNotFoundException) {
      promise.reject("E_MAP_APP", "No app is available to open this location.")
    }
  }
}
