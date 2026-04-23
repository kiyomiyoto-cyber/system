'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/actions/auth'
import type { ActionResult } from '@/types/app.types'

const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10 MB

export async function uploadPODPhoto(
  shipmentId: string,
  file: File
): Promise<ActionResult<{ path: string }>> {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!ALLOWED_PHOTO_MIME.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Use JPEG, PNG or WebP.' }
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return { success: false, error: 'File too large (max 10MB).' }
  }

  const supabase = await createClient()

  // Verify driver owns the shipment
  if (user.role === 'driver') {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    const { data: shipment } = await supabase
      .from('shipments')
      .select('driver_id')
      .eq('id', shipmentId)
      .eq('company_id', user.companyId)
      .single()
    if (!driver || !shipment || shipment.driver_id !== driver.id) {
      return { success: false, error: 'Unauthorized' }
    }
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.companyId}/${shipmentId}/${Date.now()}.${ext}`
  const service = createServiceClient()

  const { error: uploadError } = await service.storage
    .from('pod-photos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) return { success: false, error: uploadError.message }

  const { error: insertError } = await supabase.from('shipment_documents').insert({
    company_id: user.companyId,
    shipment_id: shipmentId,
    document_type: 'pod_photo',
    file_path: path,
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  })

  if (insertError) return { success: false, error: insertError.message }

  revalidatePath(`/[locale]/(driver)/delivery/${shipmentId}`, 'page')
  revalidatePath(`/[locale]/(dashboard)/shipments/${shipmentId}`, 'page')
  return { success: true, data: { path } }
}

export async function uploadSignature(
  shipmentId: string,
  signatureDataUrl: string,
  signedByName: string
): Promise<ActionResult<{ path: string }>> {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!signatureDataUrl.startsWith('data:image/png;base64,')) {
    return { success: false, error: 'Invalid signature format' }
  }

  const supabase = await createClient()
  const base64 = signatureDataUrl.replace('data:image/png;base64,', '')
  const buffer = Buffer.from(base64, 'base64')

  const path = `${user.companyId}/${shipmentId}/signature-${Date.now()}.png`
  const service = createServiceClient()

  const { error: uploadError } = await service.storage
    .from('pod-photos')
    .upload(path, buffer, { contentType: 'image/png', upsert: false })

  if (uploadError) return { success: false, error: uploadError.message }

  const { error: insertError } = await supabase.from('shipment_documents').insert({
    company_id: user.companyId,
    shipment_id: shipmentId,
    document_type: 'signature',
    file_path: path,
    file_size: buffer.length,
    mime_type: 'image/png',
    uploaded_by: user.id,
    metadata: { signed_by: signedByName },
  })

  if (insertError) return { success: false, error: insertError.message }

  revalidatePath(`/[locale]/(driver)/delivery/${shipmentId}`, 'page')
  return { success: true, data: { path } }
}

export async function getSignedPODUrl(path: string, ttlSeconds = 3600): Promise<ActionResult<{ url: string }>> {
  const user = await getAuthenticatedUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const service = createServiceClient()
  const { data, error } = await service.storage
    .from('pod-photos')
    .createSignedUrl(path, ttlSeconds)

  if (error || !data) return { success: false, error: error?.message ?? 'Failed to sign URL' }
  return { success: true, data: { url: data.signedUrl } }
}
