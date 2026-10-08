// The household key in Google Password Manager (docs/architecture.md, D4:
// the second recovery route), through Android's Credential Manager. Saved as
// a password for this app; Google Password Manager syncs it to the person's
// Google account, and a new phone with the app installed can read it back.

package app.proviso.keybackup

import androidx.credentials.CreatePasswordRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPasswordOption
import androidx.credentials.PasswordCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NoActivityException : CodedException("Open Proviso and try again.")

class KeyBackupModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KeyBackup")

    Constant("storeName") { "Google Password Manager" }

    AsyncFunction("save") Coroutine { account: String, secret: String ->
      val activity = appContext.currentActivity ?: throw NoActivityException()
      try {
        CredentialManager.create(activity).createCredential(activity, CreatePasswordRequest(account, secret))
        "saved"
      } catch (e: CreateCredentialCancellationException) {
        "cancelled"
      }
    }

    AsyncFunction("restore") Coroutine { ->
      val activity = appContext.currentActivity ?: throw NoActivityException()
      try {
        val response = CredentialManager.create(activity)
          .getCredential(activity, GetCredentialRequest(listOf(GetPasswordOption())))
        val credential = response.credential
        if (credential is PasswordCredential) listOf(mapOf("account" to credential.id, "secret" to credential.password))
        else emptyList()
      } catch (e: GetCredentialCancellationException) {
        emptyList<Map<String, String>>()
      } catch (e: NoCredentialException) {
        emptyList<Map<String, String>>()
      }
    }
  }
}
