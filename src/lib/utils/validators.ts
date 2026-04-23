import { z } from 'zod'

export const PhoneSchema = z
  .string()
  .min(10, 'Numéro de téléphone invalide')
  .regex(/^[\d\s\+\-\(\)]+$/, 'Numéro de téléphone invalide')

export const CINSchema = z
  .string()
  .min(5, 'Numéro CIN invalide')
  .max(20, 'Numéro CIN invalide')
  .regex(/^[A-Za-z]{1,2}\d+$/, 'Format CIN invalide (ex: AB123456)')

export const ICESchema = z
  .string()
  .regex(/^\d{15}$/, "L'ICE doit contenir exactement 15 chiffres")
  .optional()
  .or(z.literal(''))

export const PlateNumberSchema = z
  .string()
  .min(4, 'Immatriculation invalide')
  .max(15, 'Immatriculation invalide')
  .regex(/^[A-Za-z0-9\-\s]+$/, 'Format immatriculation invalide')

export const LatSchema = z.number().min(-90).max(90)
export const LngSchema = z.number().min(-180).max(180)

export const AddressSchema = z.object({
  street: z.string().min(2, 'Adresse requise'),
  city: z.string().min(2, 'Ville requise'),
  postal_code: z.string().optional(),
  region: z.string().optional(),
  country: z.string().length(2).default('MA'),
  lat: LatSchema.optional(),
  lng: LngSchema.optional(),
})

export const MoneySchema = z
  .number({ invalid_type_error: 'Montant invalide' })
  .nonnegative('Le montant doit être positif')
  .multipleOf(0.01, 'Maximum 2 décimales')
