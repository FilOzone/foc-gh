/**
 * Content-script helpers for Projects v2 item field updates (autosave).
 */
import type { ExtensionMessage, UpdateItemFieldMessage } from './messages.js'

async function sendMessage<T>(msg: ExtensionMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      resolve(response as T)
    })
  })
}

export type UpdateFieldPayload = UpdateItemFieldMessage['payload']

export async function updateProjectItemField(
  payload: UpdateFieldPayload,
): Promise<{ ok: boolean; error?: string }> {
  return sendMessage({ type: 'UPDATE_ITEM_FIELD', payload })
}
