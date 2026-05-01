'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Edit3,
  Loader2,
  X,
  Save,
  Star,
  StarOff,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Eye,
  ListChecks,
} from 'lucide-react'
import {
  createBlTemplate,
  updateBlTemplate,
  deleteBlTemplate,
  addBlField,
  updateBlField,
  deleteBlField,
  reorderBlFields,
  type BlTemplateInput,
  type BlFieldInput,
} from '@/actions/bl-templates'
import type { BlFieldType } from '@/types/database.types'

export interface BlFieldViewModel {
  id: string
  fieldKey: string
  label: string
  fieldType: BlFieldType
  isRequired: boolean
  isVisible: boolean
  placeholder: string | null
  defaultValue: string | null
  helpText: string | null
  selectOptions: string[]
  sortOrder: number
}

export interface BlTemplateViewModel {
  id: string
  name: string
  isDefault: boolean
  notes: string | null
  fields: BlFieldViewModel[]
}

interface ManagerProps {
  clientId: string
  clientName: string
  templates: BlTemplateViewModel[]
  canEdit: boolean
}

const FIELD_TYPES: BlFieldType[] = ['text', 'number', 'date', 'time', 'textarea', 'select']

export function BlTemplateManager({ clientId, clientName, templates, canEdit }: ManagerProps) {
  const t = useTranslations('blTemplates')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(
    templates.find((tpl) => tpl.isDefault)?.id ?? templates[0]?.id ?? null,
  )
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<BlTemplateViewModel | null>(null)
  const [editingField, setEditingField] = useState<BlFieldViewModel | null>(null)
  const [creatingField, setCreatingField] = useState(false)

  const active = templates.find((tpl) => tpl.id === activeId) ?? null

  function handleDeleteTemplate(tpl: BlTemplateViewModel) {
    if (!confirm(t('manager.confirmDeleteTemplate', { name: tpl.name }))) return
    startTransition(async () => {
      const result = await deleteBlTemplate(tpl.id)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('manager.templateDeleted'))
        if (activeId === tpl.id) setActiveId(null)
        router.refresh()
      }
    })
  }

  function handleSetDefault(tpl: BlTemplateViewModel) {
    if (tpl.isDefault) return
    startTransition(async () => {
      const result = await updateBlTemplate(tpl.id, {
        clientId,
        name: tpl.name,
        isDefault: true,
        notes: tpl.notes,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('manager.defaultUpdated'))
        router.refresh()
      }
    })
  }

  function handleDeleteField(field: BlFieldViewModel) {
    if (!confirm(t('manager.confirmDeleteField', { label: field.label }))) return
    startTransition(async () => {
      const result = await deleteBlField(field.id)
      if (result.error) toast.error(result.error)
      else {
        toast.success(t('manager.fieldDeleted'))
        router.refresh()
      }
    })
  }

  function handleMove(field: BlFieldViewModel, direction: -1 | 1) {
    if (!active) return
    const sorted = [...active.fields].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((f) => f.id === field.id)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= sorted.length) return
    const reordered = [...sorted]
    const [moved] = reordered.splice(idx, 1)
    if (!moved) return
    reordered.splice(target, 0, moved)
    startTransition(async () => {
      const result = await reorderBlFields(active.id, reordered.map((f) => f.id))
      if (result.error) toast.error(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      {/* ───── Template list ───── */}
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('manager.templatesHeading')}
          </h2>
          {canEdit && (
            <button
              type="button"
              onClick={() => setCreatingTemplate(true)}
              className="inline-flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Plus className="h-3 w-3" />
              {t('manager.addTemplate')}
            </button>
          )}
        </div>

        {templates.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            {t('manager.noTemplates')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {templates.map((tpl) => {
              const isActive = tpl.id === activeId
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(tpl.id)}
                    className={`group flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      isActive
                        ? 'border-primary/50 bg-primary/5 text-foreground'
                        : 'bg-card hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{tpl.name}</span>
                        {tpl.isDefault && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                            {t('manager.defaultBadge')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t('manager.fieldCount', { count: tpl.fields.length })}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      {/* ───── Active template + fields ───── */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        {!active ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('manager.pickTemplate')}</p>
            {canEdit && templates.length === 0 && (
              <button
                type="button"
                onClick={() => setCreatingTemplate(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('manager.firstTemplate', { client: clientName })}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold text-foreground">{active.name}</h3>
                  {active.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      {t('manager.defaultBadge')}
                    </span>
                  )}
                </div>
                {active.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{active.notes}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={isPending || active.isDefault}
                    onClick={() => handleSetDefault(active)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {active.isDefault ? <Star className="h-3.5 w-3.5 fill-current text-amber-500" /> : <StarOff className="h-3.5 w-3.5" />}
                    {active.isDefault ? t('manager.isDefault') : t('manager.setDefault')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(active)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    {t('manager.renameTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(active)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('manager.deleteTemplate')}
                  </button>
                </div>
              )}
            </header>

            <div className="flex items-center justify-between border-b pb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('manager.fieldsHeading')}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setCreatingField(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('manager.addField')}
                </button>
              )}
            </div>

            {active.fields.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                {t('manager.noFields')}
              </p>
            ) : (
              <ul className="space-y-2">
                {[...active.fields]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((field, idx, arr) => (
                    <li
                      key={field.id}
                      className={`rounded-lg border p-3 ${field.isVisible ? 'bg-background' : 'bg-muted/30 opacity-60'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={!canEdit || idx === 0 || isPending}
                            onClick={() => handleMove(field, -1)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label={t('manager.moveUp')}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canEdit || idx === arr.length - 1 || isPending}
                            onClick={() => handleMove(field, 1)}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                            aria-label={t('manager.moveDown')}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold text-foreground">{field.label}</span>
                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                              {field.fieldKey}
                            </code>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {t(`fieldType.${field.fieldType}`)}
                            </span>
                            {field.isRequired && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                {t('manager.requiredBadge')}
                              </span>
                            )}
                            {!field.isVisible && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <EyeOff className="h-3 w-3" />
                                {t('manager.hiddenBadge')}
                              </span>
                            )}
                          </div>
                          {field.placeholder && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('manager.placeholderLabel')}: {field.placeholder}
                            </p>
                          )}
                          {field.fieldType === 'select' && field.selectOptions.length > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('manager.optionsLabel')}: {field.selectOptions.join(', ')}
                            </p>
                          )}
                          {field.helpText && (
                            <p className="mt-1 text-xs italic text-muted-foreground">{field.helpText}</p>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingField(field)}
                              className="rounded-lg border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={t('manager.editField')}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteField(field)}
                              disabled={isPending}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 disabled:opacity-50"
                              aria-label={t('manager.deleteField')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ───── Modals ───── */}
      {(creatingTemplate || editingTemplate) && (
        <TemplateDialog
          clientId={clientId}
          template={editingTemplate}
          existingDefault={templates.find((tpl) => tpl.isDefault) ?? null}
          onClose={() => {
            setCreatingTemplate(false)
            setEditingTemplate(null)
          }}
          onSaved={(newId) => {
            setCreatingTemplate(false)
            setEditingTemplate(null)
            if (newId) setActiveId(newId)
            router.refresh()
          }}
        />
      )}

      {active && (creatingField || editingField) && (
        <FieldDialog
          templateId={active.id}
          field={editingField}
          existingKeys={active.fields
            .filter((f) => !editingField || f.id !== editingField.id)
            .map((f) => f.fieldKey)}
          nextSortOrder={
            (active.fields.length === 0
              ? 10
              : Math.max(...active.fields.map((f) => f.sortOrder)) + 10)
          }
          onClose={() => {
            setCreatingField(false)
            setEditingField(null)
          }}
          onSaved={() => {
            setCreatingField(false)
            setEditingField(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// TemplateDialog
// ============================================================
interface TemplateDialogProps {
  clientId: string
  template: BlTemplateViewModel | null
  existingDefault: BlTemplateViewModel | null
  onClose: () => void
  onSaved: (id: string | null) => void
}

function TemplateDialog({ clientId, template, existingDefault, onClose, onSaved }: TemplateDialogProps) {
  const t = useTranslations('blTemplates')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(template?.name ?? '')
  const [notes, setNotes] = useState(template?.notes ?? '')
  const [isDefault, setIsDefault] = useState(
    template?.isDefault ?? !existingDefault, // first template auto-default
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('dialog.nameRequired'))
      return
    }
    const payload: BlTemplateInput = {
      clientId,
      name: name.trim(),
      isDefault,
      notes: notes.trim() || null,
    }
    startTransition(async () => {
      const result = template
        ? await updateBlTemplate(template.id, payload)
        : await createBlTemplate(payload)
      if (result.error) toast.error(result.error)
      else {
        toast.success(template ? t('dialog.templateUpdated') : t('dialog.templateCreated'))
        onSaved(result.data?.templateId ?? null)
      }
    })
  }

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[95vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-foreground">
            {template ? t('dialog.editTemplate') : t('dialog.newTemplate')}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('dialog.templateName')} *
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dialog.templateNamePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('dialog.notes')}
            </label>
            <textarea
              className={inputClass}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="font-medium">{t('dialog.isDefault')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('dialog.isDefaultHint')}
              </span>
            </span>
          </label>
        </div>

        <div className="flex shrink-0 gap-2 border-t bg-card p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================
// FieldDialog
// ============================================================
interface FieldDialogProps {
  templateId: string
  field: BlFieldViewModel | null
  existingKeys: string[]
  nextSortOrder: number
  onClose: () => void
  onSaved: () => void
}

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1')
    .slice(0, 50)
}

function FieldDialog({ templateId, field, existingKeys, nextSortOrder, onClose, onSaved }: FieldDialogProps) {
  const t = useTranslations('blTemplates')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  const [label, setLabel] = useState(field?.label ?? '')
  const [fieldKey, setFieldKey] = useState(field?.fieldKey ?? '')
  const [keyEdited, setKeyEdited] = useState(field !== null)
  const [fieldType, setFieldType] = useState<BlFieldType>(field?.fieldType ?? 'text')
  const [isRequired, setIsRequired] = useState(field?.isRequired ?? false)
  const [isVisible, setIsVisible] = useState(field?.isVisible ?? true)
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? '')
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? '')
  const [helpText, setHelpText] = useState(field?.helpText ?? '')
  const [selectOptions, setSelectOptions] = useState(field?.selectOptions.join('\n') ?? '')

  function handleLabelChange(value: string) {
    setLabel(value)
    if (!keyEdited) setFieldKey(slugifyKey(value))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) {
      toast.error(t('dialog.labelRequired'))
      return
    }
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(fieldKey)) {
      toast.error(t('dialog.keyInvalid'))
      return
    }
    if (existingKeys.includes(fieldKey)) {
      toast.error(t('dialog.keyDuplicate'))
      return
    }
    const options = fieldType === 'select'
      ? selectOptions.split('\n').map((s) => s.trim()).filter(Boolean)
      : []
    if (fieldType === 'select' && options.length === 0) {
      toast.error(t('dialog.optionsRequired'))
      return
    }

    const payload: BlFieldInput = {
      fieldKey,
      label: label.trim(),
      fieldType,
      isRequired,
      isVisible,
      placeholder: placeholder.trim() || null,
      defaultValue: defaultValue.trim() || null,
      helpText: helpText.trim() || null,
      selectOptions: options,
      sortOrder: field?.sortOrder ?? nextSortOrder,
    }
    startTransition(async () => {
      const result = field
        ? await updateBlField(field.id, payload)
        : await addBlField(templateId, payload)
      if (result.error) toast.error(result.error)
      else {
        toast.success(field ? t('dialog.fieldUpdated') : t('dialog.fieldCreated'))
        onSaved()
      }
    })
  }

  const inputClass =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[95vh] w-full max-w-lg flex-col rounded-t-2xl bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-foreground">
            {field ? t('dialog.editField') : t('dialog.newField')}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('dialog.fieldLabel')} *
            </label>
            <input
              className={inputClass}
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder={t('dialog.fieldLabelPlaceholder')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('dialog.fieldKey')} *
            </label>
            <input
              className={`${inputClass} font-mono`}
              value={fieldKey}
              onChange={(e) => {
                setKeyEdited(true)
                setFieldKey(e.target.value.toLowerCase())
              }}
              placeholder="po_number"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{t('dialog.fieldKeyHint')}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {t('dialog.fieldType')} *
              </label>
              <select
                className={inputClass}
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as BlFieldType)}
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {t(`fieldType.${ft}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {t('dialog.placeholder')}
              </label>
              <input
                className={inputClass}
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('dialog.defaultValue')}
            </label>
            <input
              className={inputClass}
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </div>

          {fieldType === 'select' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                {t('dialog.selectOptions')} *
              </label>
              <textarea
                className={`${inputClass} font-mono`}
                rows={4}
                value={selectOptions}
                onChange={(e) => setSelectOptions(e.target.value)}
                placeholder={t('dialog.selectOptionsPlaceholder')}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('dialog.selectOptionsHint')}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {t('dialog.helpText')}
            </label>
            <input
              className={inputClass}
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span>{t('dialog.isRequired')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="inline-flex items-center gap-1">
                {isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {t('dialog.isVisible')}
              </span>
            </label>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t bg-card p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
