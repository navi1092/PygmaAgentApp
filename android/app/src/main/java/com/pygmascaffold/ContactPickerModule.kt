package com.pygma

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.provider.ContactsContract
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ContactPickerModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {

  private var pendingPromise: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName(): String = "PygmaContactPicker"

  @ReactMethod
  fun selectPhone(promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("E_CONTACT_PICKER_OPEN", "The contact picker is already open.")
      return
    }

    val activity = currentActivity
    if (activity == null) {
      promise.reject("E_CONTACT_PICKER_ACTIVITY", "Unable to open contacts right now.")
      return
    }

    pendingPromise = promise
    val intent = Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
    activity.startActivityForResult(intent, REQUEST_CODE)
  }

  override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE) return

    val promise = pendingPromise
    pendingPromise = null
    if (promise == null) return
    if (resultCode != Activity.RESULT_OK || data?.data == null) {
      promise.resolve(null)
      return
    }

    var cursor: Cursor? = null
    try {
      cursor = context.contentResolver.query(
        data.data!!,
        arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
        null,
        null,
        null
      )
      val number = if (cursor?.moveToFirst() == true) cursor.getString(0) else null
      promise.resolve(number)
    } catch (error: Exception) {
      promise.reject("E_CONTACT_PICKER_READ", error)
    } finally {
      cursor?.close()
    }
  }

  override fun onNewIntent(intent: Intent?) = Unit

  override fun invalidate() {
    pendingPromise?.resolve(null)
    pendingPromise = null
    context.removeActivityEventListener(this)
    super.invalidate()
  }

  companion object {
    private const val REQUEST_CODE = 4107
  }
}