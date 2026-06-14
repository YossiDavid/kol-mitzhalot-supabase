"use client"

import React, { Fragment } from "react"
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { SearchSelectField } from "./search-select-field"
import Upload from "./upload"
import { Control, useFieldArray } from "react-hook-form"
import { cn } from "@/lib/utils"
import { PlusCircle, Trash, Trash2 } from "lucide-react"
import { ReactJewishDatePicker } from "@yossidavid/react-jewish-datepicker"

type FieldMetadata = Record<string, any>

export type DynamicFieldProps = {
	field: FieldMetadata
	control: Control<any>
	values: Record<string, any>
	gender: "male" | "female" | ""
	getLabel: (field: FieldMetadata, gender: "male" | "female" | "") => string
}

export function DynamicField({
	field,
	control,
	values,
	gender,
	getLabel,
}: DynamicFieldProps) {
	if (!shouldDisplayField(field, values)) {
		return null
	}

	if (isRepeaterField(field)) {
		return (
			<div className="col-span-12">
				<RepeaterFieldRenderer
					field={field}
					control={control}
					values={values}
					gender={gender}
					getLabel={getLabel}
				/>
			</div>
		)
	}

	return (
		<div className={getColumnClass(field.columns)}>
			<AtomicFieldRenderer
				field={field}
				control={control}
				values={values}
				gender={gender}
				getLabel={getLabel}
			/>
		</div>
	)
}

function AtomicFieldRenderer({
	field,
	control,
	values,
	gender,
	getLabel,
}: DynamicFieldProps) {
	const { type, name } = field
	const rawField = field as FieldMetadata
	const linkedIdPath: string | undefined =
		typeof rawField.linkedIdPath === "string"
			? rawField.linkedIdPath
			: undefined
	const isIdField = Boolean(rawField.isIdField)
	const linkedIdValue = linkedIdPath
		? getValueByPath(values, linkedIdPath)
		: undefined
	const disableBecauseLinkedId = !isIdField && hasNonEmptyValue(linkedIdValue)
	const placeholder: string | undefined = rawField.placeholder
	const description: string | undefined = rawField.description
	const beforeField: React.ReactNode = rawField.beforeField ?? rawField.before
	const options: Array<{ value: string; label: string }> =
		(rawField.options as Array<{ value: string; label: string }>) ?? []
	const isRequired = Boolean(rawField.required)
	const isVertical = Boolean(rawField.vertical)
	const emptyLabel: string | undefined = rawField.empty
	const endpoint: string | undefined =
		typeof rawField.endpoint === "string" ? rawField.endpoint : undefined
	const table: string | undefined =
		typeof rawField.table === "string" ? rawField.table : undefined
	const valueColumn: string | undefined =
		typeof rawField.valueColumn === "string" ? rawField.valueColumn : undefined
	const labelColumn: string | undefined =
		typeof rawField.labelColumn === "string" ? rawField.labelColumn : undefined
	const searchColumn: string | undefined =
		typeof rawField.searchColumn === "string" ? rawField.searchColumn : undefined
	const filters: Record<string, any> | undefined =
		typeof rawField.filters === "object" && rawField.filters !== null
			? rawField.filters
			: undefined
	const params: Record<string, any> | undefined =
		typeof rawField.params === "object" && rawField.params !== null
			? rawField.params
			: undefined
	const label = getLabel(field, gender)
	const fieldId = toFieldId(name)

	if (isTextAndSelectFieldType(type)) {
		const prefixOptions: Array<{ value: string; label: string }> =
			(rawField.prefixOptions as Array<{
				value: string
				label: string
			}>) ?? []
		const prefixPlaceholder: string | undefined =
			rawField.prefixPlaceholder ?? "תואר"
		return (
			<Fragment>
				{renderBeforeField(beforeField)}
				<FormField
					control={control}
					name={name as any}
					render={({ field: rhfField }) => {
						const value = ensureNamePartsValue(rhfField.value)

						const updateFieldValue = (
							key: "prefix" | "name" | "suffix",
							nextValue: string
						) => {
							rhfField.onChange({
								...value,
								[key]: nextValue,
							})
						}

						return (
							<FormItem>
								<FormLabel htmlFor={fieldId}>
									{label}
									{isRequired && (
										<span className="text-destructive">
											*
										</span>
									)}
								</FormLabel>
								<FormControl>
									<div className="group/text-and-select flex flex-row rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
										{prefixOptions.length > 0 && (
											<div className="relative shrink-0">
												<NativeSelect
													value={value.prefix}
													onChange={(e) =>
														updateFieldValue(
															"prefix",
															e.target.value
														)
													}
													disabled={disableBecauseLinkedId}
													className="w-[72px] shrink-0 md:w-[100px] text-xs border-0 rounded-none rounded-r-md shadow-none focus-visible:ring-0 focus-visible:border-0 [&_select]:rounded-r-md"
												>
													{!value.prefix && (
														<NativeSelectOption value="" disabled>
															{prefixPlaceholder}
														</NativeSelectOption>
													)}
													{prefixOptions.map((option) => (
														<NativeSelectOption
															key={option.value}
															value={option.value}
														>
															{option.label}
														</NativeSelectOption>
													))}
												</NativeSelect>
											</div>
										)}
										<div className="relative flex-1">
											<Input
												id={fieldId}
												value={value.name}
												onChange={(event) =>
													updateFieldValue(
														"name",
														event.target.value
													)
												}
												onBlur={rhfField.onBlur}
												ref={rhfField.ref}
												disabled={disableBecauseLinkedId}
												className="border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-0"
											/>
										</div>
										<div className="relative shrink-0">
											<NativeSelect
												value={value.suffix}
												onChange={(e) =>
													updateFieldValue(
														"suffix",
														e.target.value
													)
												}
												disabled={disableBecauseLinkedId}
												className="w-[72px] shrink-0 md:w-[100px] text-xs border-0 rounded-none rounded-l-md shadow-none focus-visible:ring-0 focus-visible:border-0 [&_select]:rounded-l-md"
											>
												{!value.suffix && (
													<NativeSelectOption value="" disabled>
														{placeholder ?? "תואר"}
													</NativeSelectOption>
												)}
												{options.map((option) => (
													<NativeSelectOption
														key={option.value}
														value={option.value}
													>
														{option.label}
													</NativeSelectOption>
												))}
											</NativeSelect>
										</div>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)
					}}
				/>
			</Fragment>
		)
	}

	if (isTextFieldType(type)) {
		return (
			<Fragment>
				{renderBeforeField(beforeField)}
				<FormField
					control={control}
					name={name as any}
					render={({ field: rhfField }) => (
						<FormItem>
							<FormLabel htmlFor={fieldId}>
								{label}
								{isRequired && (
									<span className="text-destructive">*</span>
								)}
							</FormLabel>
							<FormControl>
								{type === "textarea" ? (
									<Textarea
										id={fieldId}
										value={ensureStringValue(
											rhfField.value
										)}
										onChange={(event) =>
											rhfField.onChange(
												event.target.value
											)
										}
										onBlur={rhfField.onBlur}
										ref={rhfField.ref}
										placeholder={placeholder}
										className="min-h-[120px]"
										disabled={disableBecauseLinkedId}
									/>
								) : type === "date" ? (
									<div
										onClickCapture={(event) => {
											const target =
												event.target as HTMLElement
											if (target.closest("button")) {
												event.preventDefault()
											}
										}}
										onMouseDownCapture={(event) => {
											const target =
												event.target as HTMLElement
											if (target.closest("button")) {
												event.preventDefault()
											}
										}}
									>
										<ReactJewishDatePicker
											id={fieldId}
											value={ensureStringValue(
												rhfField.value
											)}
											input="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
											wrapperClassName="font-[ploni]"
											calendarWrapper="absolute z-10 mt-1 w-full rounded-lg border bg-white p-2 shadow-lg scale-y-0 origin-top transition"
											calendarWrapperOpen="scale-y-100"
											calendar="w-full bg-white"
											header="flex items-center justify-between py-2 px-1 bg-gray-100 rounded-t-md border-b border-gray-300"
											navButton="p-1 rounded hover:bg-gray-200"
											select="font-light"
											weekdayHeader="mb-2 grid grid-cols-7 text-center text-xs font-bold text-gray-600"
											dayCell="flex flex-col items-center justify-center rounded-md border px-2 py-2"
											dayCellSelected="border-blue-500 bg-blue-100 font-bold"
											dayCellOutsideMonth="opacity-50"
											onChange={() => {
												if (
													typeof window ===
													"undefined"
												) {
													rhfField.onChange("")
													return
												}
												const updateValue = () => {
													const inputEl =
														document.getElementById(
															fieldId
														) as HTMLInputElement | null
													const gregDate =
														inputEl?.getAttribute(
															"data-greg-date"
														) ?? ""
													rhfField.onChange(gregDate)
												}

												if (
													typeof window.requestAnimationFrame ===
													"function"
												) {
													window.requestAnimationFrame(
														updateValue
													)
												} else {
													setTimeout(updateValue, 0)
												}
											}}
										/>
									</div>
								) : (
									<Input
										id={fieldId}
										value={ensureStringValue(
											rhfField.value
										)}
										onChange={(event) =>
											rhfField.onChange(
												event.target.value
											)
										}
										onBlur={rhfField.onBlur}
										ref={rhfField.ref}
										type={
											type === "number"
												? "number"
												: "text"
										}
										placeholder={placeholder}
										disabled={disableBecauseLinkedId}
									/>
								)}
							</FormControl>
							{description && (
								<p className="text-sm text-muted-foreground">
									{description}
								</p>
							)}
							<FormMessage />
						</FormItem>
					)}
				/>
			</Fragment>
		)
	}

	if (isSelectFieldType(type)) {
		if (type === "select2") {
			return (
				<Fragment>
					{renderBeforeField(beforeField)}
					<FormField
						control={control}
						name={name as any}
						render={({ field: rhfField }) => (
							<FormItem>
								<FormLabel>
									{label}
									{isRequired && (
										<span className="text-destructive">
											*
										</span>
									)}
								</FormLabel>
								<FormControl>
									<SearchSelectField
										placeholder={
											placeholder ?? "חיפוש במאגר..."
										}
										options={options}
										empty={emptyLabel ?? "לא נמצאו תוצאות"}
										value={ensureStringValue(
											rhfField.value
										)}
										onChange={rhfField.onChange}
										endpoint={endpoint}
										table={table}
										valueColumn={valueColumn}
										labelColumn={labelColumn}
										searchColumn={searchColumn}
										filters={filters}
										params={params}
										disabled={disableBecauseLinkedId}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</Fragment>
			)
		}

		if (type === "checkbox") {
			return (
				<Fragment>
					{renderBeforeField(beforeField)}
					<FormField
						control={control}
						name={name as any}
						render={({ field: rhfField }) => {
							const currentValue = ensureStringArray(
								rhfField.value
							)

							const toggleValue = (optionValue: string) => {
								if (currentValue.includes(optionValue)) {
									rhfField.onChange(
										currentValue.filter(
											(value) => value !== optionValue
										)
									)
								} else {
									rhfField.onChange([
										...currentValue,
										optionValue,
									])
								}
							}

							return (
								<FormItem className="space-y-3">
									<FormLabel>
										{label}
										{isRequired && (
											<span className="text-destructive">
												*
											</span>
										)}
									</FormLabel>
									<FormControl>
										<div
											className={cn(
												"flex flex-wrap gap-3",
												isVertical &&
												"flex-col flex-nowrap"
											)}
										>
											{options.map((option) => (
												<label
													key={option.value}
													className="flex items-center gap-2"
												>
													<Checkbox
														checked={currentValue.includes(
															option.value
														)}
														onCheckedChange={() => {
															if (
																disableBecauseLinkedId
															) {
																return
															}
															toggleValue(
																option.value
															)
														}}
														disabled={
															disableBecauseLinkedId
														}
													/>
													<span>{option.label}</span>
												</label>
											))}
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)
						}}
					/>
				</Fragment>
			)
		}

		if (type === "radio") {
			return (
				<Fragment>
					{renderBeforeField(beforeField)}
					<FormField
						control={control}
						name={name as any}
						render={({ field: rhfField }) => (
							<FormItem className="space-y-3">
								<FormLabel>
									{label}
									{isRequired && (
										<span className="text-destructive">
											*
										</span>
									)}
								</FormLabel>
								<FormControl>
									<div
										className={cn(
											"flex flex-wrap gap-3",
											isVertical && "flex-col flex-nowrap"
										)}
									>
										{options.map((option) => (
											<label
												key={option.value}
												className="flex items-center gap-2"
											>
												<input
													type="radio"
													value={option.value}
													checked={
														ensureStringValue(
															rhfField.value
														) === option.value
													}
													onChange={() => {
														if (
															disableBecauseLinkedId
														) {
															return
														}
														rhfField.onChange(
															option.value
														)
													}}
													className="size-4 accent-primary"
													disabled={
														disableBecauseLinkedId
													}
												/>
												<span>{option.label}</span>
											</label>
										))}
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</Fragment>
			)
		}

		if (type === "chips" || type === "chip") {
			return (
				<Fragment>
					{renderBeforeField(beforeField)}
					<FormField
						control={control}
						name={name as any}
						render={({ field: rhfField }) => {
							const currentValue = ensureStringArray(
								rhfField.value
							)

							const toggleChip = (value: string) => {
								if (disableBecauseLinkedId) {
									return
								}

								if (currentValue.includes(value)) {
									rhfField.onChange(
										currentValue.filter(
											(item) => item !== value
										)
									)
								} else {
									rhfField.onChange([...currentValue, value])
								}
							}

							return (
								<FormItem className="space-y-3">
									<FormLabel>
										{label}
										{isRequired && (
											<span className="text-destructive">
												*
											</span>
										)}
									</FormLabel>
									<FormControl>
										<div className="flex flex-wrap gap-2">
											{options.map((option) => {
												const isActive =
													currentValue.includes(
														option.value
													)
												return (
													<Button
														type="button"
														key={option.value}
														variant={
															isActive
																? "default"
																: "outline"
														}
														onClick={() =>
															toggleChip(
																option.value
															)
														}
														disabled={
															disableBecauseLinkedId
														}
														className="rounded-full px-4"
													>
														{option.label}
													</Button>
												)
											})}
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)
						}}
					/>
				</Fragment>
			)
		}

		if (type === "inputAndSelect") {
			return null
		}

		return (
			<Fragment>
				{renderBeforeField(beforeField)}
				<FormField
					control={control}
					name={name as any}
					render={({ field: rhfField }) => {
						const currentValue = ensureStringValue(rhfField.value)
						const placeholderText = placeholder ?? "בחרו מהרשימה"

						return (
							<FormItem>
								<FormLabel>
									{label}
									{isRequired && (
										<span className="text-destructive">*</span>
									)}
								</FormLabel>
								<FormControl>
									<NativeSelect
										value={currentValue}
										onChange={(e) => rhfField.onChange(e.target.value)}
										onBlur={rhfField.onBlur}
										disabled={disableBecauseLinkedId}
									>
										{!currentValue && (
											<NativeSelectOption value="" disabled>
												{placeholderText}
											</NativeSelectOption>
										)}
										{options.map((option) => (
											<NativeSelectOption
												key={option.value}
												value={option.value}
											>
												{option.label}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</FormControl>
								<FormMessage />
							</FormItem>
						)
					}}
				/>
			</Fragment>
		)
	}

	if (isRangeFieldType(type)) {
		return (
			<Fragment>
				{renderBeforeField(beforeField)}
				<FormField
					control={control}
					name={name as any}
					render={({ field: rhfField }) => {
						const storeAsObject = isRecord(rhfField.value)
						const value = ensureRangeTuple(rhfField.value, [18, 40])

						const updateValue = (index: number, next: number) => {
							const [minValue, maxValue] = value
							if (storeAsObject) {
								const nextPayload = {
									min: index === 0 ? next : minValue,
									max: index === 1 ? next : maxValue,
								}
								rhfField.onChange(nextPayload)
							} else {
								const nextRange = [...value] as [number, number]
								nextRange[index] = next
								rhfField.onChange(nextRange)
							}
						}

						return (
							<FormItem>
								<FormLabel>
									{label}
									{isRequired && (
										<span className="text-destructive">
											*
										</span>
									)}
								</FormLabel>
								<div className="flex items-center gap-3">
									<Input
										type="number"
										value={value[0]}
										onChange={(event) =>
											!disableBecauseLinkedId &&
											updateValue(
												0,
												Number(event.target.value)
											)
										}
										disabled={disableBecauseLinkedId}
									/>
									<span>עד</span>
									<Input
										type="number"
										value={value[1]}
										onChange={(event) =>
											!disableBecauseLinkedId &&
											updateValue(
												1,
												Number(event.target.value)
											)
										}
										disabled={disableBecauseLinkedId}
									/>
								</div>
								<FormMessage />
							</FormItem>
						)
					}}
				/>
			</Fragment>
		)
	}

	if (isUploadFieldType(type)) {
		const isMultiUpload = name.endsWith(".documents")

		return (
			<Fragment>
				{renderBeforeField(beforeField)}
				<FormField
					control={control}
					name={name as any}
					render={({ field: rhfField }) => {
						const files: File[] = (() => {
							if (isMultiUpload) {
								return Array.isArray(rhfField.value)
									? (rhfField.value as File[])
									: []
							}

							if (isRecord(rhfField.value)) {
								const singleFile = (
									rhfField.value as Record<string, unknown>
								).file
								return singleFile instanceof File
									? [singleFile]
									: []
							}

							return []
						})()

						const handleFilesChange = (nextFiles: File[]) => {
							if (isMultiUpload) {
								rhfField.onChange(nextFiles)
							} else {
								const base = isRecord(rhfField.value)
									? (rhfField.value as Record<
										string,
										unknown
									>)
									: {}
								rhfField.onChange({
									...base,
									file: nextFiles[0] ?? null,
								})
							}
						}

						return (
							<FormItem>
								<FormLabel>
									{label}
									{isRequired && (
										<span className="text-destructive">
											*
										</span>
									)}
								</FormLabel>
								<FormControl>
									<Upload
										accept={rawField.accept}
										multiple={isMultiUpload}
										value={files}
										onChange={handleFilesChange}
									/>
								</FormControl>
								{description && (
									<p className="text-sm text-muted-foreground">
										{description}
									</p>
								)}
								<FormMessage />
							</FormItem>
						)
					}}
				/>
			</Fragment>
		)
	}

	return null
}

type RepeaterFieldRendererProps = {
	field: FieldMetadata
	control: Control<any>
	values: Record<string, any>
	gender: "male" | "female" | ""
	getLabel: (field: FieldMetadata, gender: "male" | "female" | "") => string
}

function RepeaterFieldRenderer({
	field,
	control,
	values,
	gender,
	getLabel,
}: RepeaterFieldRendererProps) {
	const { fields, append, remove } = useFieldArray({
		control,
		name: field.name as any,
	})

	const template = React.useMemo(() => createRepeaterTemplate(field), [field])

	const handleAdd = () => {
		append(deepClone(template))
	}

	const beforeField = field.beforeField ?? field.before

	return (
		<div className="space-y-4 rounded-lg border border-dashed border-slate-300 p-4">
			{renderBeforeField(beforeField)}
			<div className="space-y-4">
				{fields.length === 0 && (
					<p className="text-sm text-muted-foreground">
						אין רשומות עדיין. ניתן להוסיף באמצעות הכפתור למטה.
					</p>
				)}

				{fields.map((item, index) => {
					const idFieldPaths = new Set(
						field.fileds
							.filter(
								(candidate: FieldMetadata) =>
									typeof candidate.name === "string" &&
									getLastPathSegment(
										(candidate.originalName ??
											candidate.name) as string
									) === "id"
							)
							.map((candidate: FieldMetadata) =>
								resolveFieldName(
									candidate.name as string,
									field.name,
									index
								)
							)
					)

					return (
						<div
							key={item.id}
							className={cn(
								"space-y-4 rounded-lg border border-slate-200 p-4",
								field.fileds.length <= 4
									? "md:flex items-center"
									: ""
							)}
						>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-12 flex-1">
								{field.fileds.map(
									(innerField: FieldMetadata) => {
										const resolvedName = resolveFieldName(
											innerField.name,
											field.name,
											index
										)
										const innerFieldAny =
											innerField as FieldMetadata
										const adjustedConditions =
											innerFieldAny.condition?.map(
												(condition: any) => ({
													...condition,
													parameter: resolveFieldName(
														condition.parameter,
														field.name,
														index
													),
												})
											)

										const linkedIdPath =
											determineLinkedIdPath(
												resolvedName,
												idFieldPaths as any
											)

										const innerFieldConfig = {
											...innerFieldAny,
											name: resolvedName,
											condition: adjustedConditions,
											originalName:
												innerFieldAny.originalName ??
												innerFieldAny.name,
											isIdField:
												idFieldPaths.has(resolvedName),
											linkedIdPath,
										}

										if (
											!shouldDisplayField(
												innerFieldConfig,
												values
											)
										) {
											return null
										}

										return (
											<div
												key={
													innerFieldAny.originalName ??
													innerFieldAny.name
												}
												className={getColumnClass(
													innerFieldAny.columns
												)}
											>
												<AtomicFieldRenderer
													field={innerFieldConfig}
													control={control}
													values={values}
													gender={gender}
													getLabel={getLabel}
												/>
											</div>
										)
									}
								)}
							</div>
							<Button
								type="button"
								variant={
									field.fileds.length <= 4
										? "ghost"
										: "secondary"
								}
								size={
									field.fileds.length <= 4
										? "icon"
										: undefined
								}
								aria-label="מחיקת רשומה"
								onClick={() => remove(index)}
								className="flex items-center gap-2 text-destructive"
							>
								<Trash2 />
								{field.fileds.length > 4 && "מחיקת רשומה"}
							</Button>
						</div>
					)
				})}
			</div>

			<Button
				type="button"
				variant="ghost"
				onClick={handleAdd}
				className="flex items-center gap-2"
			>
				<PlusCircle />
				<span>הוספת רשומה</span>
			</Button>
		</div>
	)
}

function renderBeforeField(beforeField: React.ReactNode) {
	if (!beforeField) {
		return null
	}

	if (typeof beforeField === "string") {
		return (
			<div
				dangerouslySetInnerHTML={{ __html: beforeField }}
				className="mb-4 space-y-2 [&>hr]:my-7 "
			/>
		)
	}

	return <>{beforeField}</>
}

function determineLinkedIdPath(fieldName: string, idFieldPaths: Set<string>) {
	if (idFieldPaths.size === 0) {
		return undefined
	}

	if (idFieldPaths.has(fieldName)) {
		return fieldName
	}

	const parentPath = getParentPath(fieldName)
	if (!parentPath) {
		return undefined
	}

	const candidate = `${parentPath}.id`
	return idFieldPaths.has(candidate) ? candidate : undefined
}

function shouldDisplayField(field: FieldMetadata, values: Record<string, any>) {
	if (!field.condition || field.condition.length === 0) {
		return true
	}

	return field.condition.every((condition: any) => {
		const compareValue = getValueByPath(values, condition.parameter)
		switch (condition.operator) {
			case "===":
				return compareValue === condition.value
			case "!==":
				return compareValue !== condition.value
			case "includes":
				return Array.isArray(compareValue)
					? compareValue.includes(condition.value)
					: typeof compareValue === "string" &&
					compareValue.includes(condition.value)
			case "in":
				return (
					Array.isArray(condition.value) &&
					condition.value.includes(String(compareValue ?? ""))
				)
			default:
				return true
		}
	})
}

function getParentPath(path: string) {
	const normalized = path.replace(/\[(\d+)\]/g, ".$1")
	const segments = normalized.split(".").filter(Boolean)
	segments.pop()
	return segments.join(".")
}

function getLastPathSegment(path: string) {
	const normalized = path.replace(/\[(\d+)\]/g, ".$1")
	const segments = normalized.split(".").filter(Boolean)
	return segments[segments.length - 1] ?? ""
}

function getColumnClass(columns?: number) {
	if (columns === undefined || columns === null) {
		return "col-span-12"
	}

	if (columns === -1) {
		return "col-span-12"
	}

	const base = Math.max(1, columns)
	const span = Math.min(12, base <= 6 ? base * 1 : base)

	const COLUMN_CLASSES: Record<number, string> = {
		1: "col-span-12 md:col-span-1",
		2: "col-span-12 md:col-span-2",
		3: "col-span-12 md:col-span-3",
		4: "col-span-12 md:col-span-4",
		5: "col-span-12 md:col-span-5",
		6: "col-span-12 md:col-span-6",
		7: "col-span-12 md:col-span-7",
		8: "col-span-12 md:col-span-8",
		9: "col-span-12 md:col-span-9",
		10: "col-span-12 md:col-span-10",
		11: "col-span-12 md:col-span-11",
		12: "col-span-12 md:col-span-12",
		"-1": "col-span-12 md:col-span-12",
	}

	return COLUMN_CLASSES[span] ?? "col-span-12 md:col-span-12"
}

function isRepeaterField(field: FieldMetadata) {
	return field.type === "repeater"
}

function isTextFieldType(type: unknown) {
	return ["text", "number", "date", "textarea", "switch"].includes(
		String(type)
	)
}

function isSelectFieldType(type: unknown) {
	return [
		"select",
		"select2",
		"chips",
		"chip",
		"inputAndSelect",
		"checkbox",
		"radio",
	].includes(String(type))
}

function isTextAndSelectFieldType(type: unknown) {
	return String(type) === "textAndSelect"
}

function isRangeFieldType(type: unknown) {
	return ["range", "rangeDouble"].includes(String(type))
}

function isUploadFieldType(type: unknown) {
	return String(type) === "upload"
}

function toFieldId(name: string) {
	return name.replace(/[^a-zA-Z0-9]+/g, "-")
}

function ensureStringValue(value: unknown): string {
	if (typeof value === "string" || typeof value === "number") {
		return String(value)
	}
	return ""
}

function ensureStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => String(item))
	}
	return []
}

function ensureNamePartsValue(value: unknown): {
	prefix: string
	name: string
	suffix: string
} {
	if (isRecord(value)) {
		const prefixValue = value["prefix"]
		const nameValue = value["name"]
		const suffixValue = value["suffix"]
		const prefix = typeof prefixValue === "string" ? prefixValue : ""
		const name = typeof nameValue === "string" ? nameValue : ""
		const suffix = typeof suffixValue === "string" ? suffixValue : ""
		return { prefix, name, suffix }
	}
	return { prefix: "", name: "", suffix: "" }
}

function ensureRangeTuple(
	value: unknown,
	fallback: [number, number]
): [number, number] {
	if (isRecord(value)) {
		const minValue = value["min"]
		const maxValue = value["max"]
		if (typeof minValue === "number" && typeof maxValue === "number") {
			return [minValue, maxValue]
		}
	}

	if (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((item) => typeof item === "number")
	) {
		return [value[0], value[1]] as [number, number]
	}
	return fallback
}

function resolveFieldName(baseName: string, arrayName: string, index: number) {
	if (baseName === arrayName) {
		return `${arrayName}.${index}`
	}

	if (baseName.startsWith(`${arrayName}.`)) {
		const suffix = baseName.slice(arrayName.length + 1)
		return `${arrayName}.${index}.${suffix}`
	}

	return baseName
}

function normalizePath(path: string) {
	return path.replace(/\[\d+\]/g, "")
}

function getValueByPath(source: Record<string, any>, path: string) {
	if (!path) return undefined
	const segments = path
		.replace(/\[(\d+)\]/g, ".$1")
		.split(".")
		.filter(Boolean)

	return segments.reduce<any>((acc, segment) => {
		if (acc == null) return undefined
		return acc[segment]
	}, source)
}

function hasNonEmptyValue(value: unknown) {
	if (value === null || value === undefined) {
		return false
	}

	if (typeof value === "string") {
		return value.trim().length > 0
	}

	if (typeof value === "number") {
		return !Number.isNaN(value)
	}

	if (typeof value === "boolean") {
		return value
	}

	if (Array.isArray(value)) {
		return value.length > 0
	}

	if (typeof value === "object") {
		return Object.keys(value as Record<string, unknown>).length > 0
	}

	return false
}

function createRepeaterTemplate(field: FieldMetadata) {
	const template: Record<string, any> = {}
	field.fileds.forEach((innerField: FieldMetadata) => {
		const originalName = innerField.originalName ?? innerField.name
		let relativePath = originalName
		if (originalName === field.name) {
			relativePath = ""
		} else if (originalName.startsWith(`${field.name}.`)) {
			relativePath = originalName.slice(field.name.length + 1)
		}

		if (!relativePath) {
			return
		}

		setNestedValue(
			template,
			relativePath,
			getDefaultValueForField(innerField)
		)
	})
	return template
}

function getDefaultValueForField(field: FieldMetadata) {
	switch (field.type) {
		case "chip":
		case "chips":
		case "checkbox":
			return []
		case "range":
		case "rangeDouble":
			return [0, 0]
		case "switch":
			return false
		case "upload":
			return field.name.endsWith(".documents") ? [] : { file: null }
		case "textAndSelect":
			return { prefix: "", name: "", suffix: "" }
		default:
			return ""
	}
}

function setNestedValue(target: Record<string, any>, path: string, value: any) {
	if (!path) {
		return
	}

	const segments = path.split(".")
	let current = target

	segments.forEach((segment, index) => {
		if (index === segments.length - 1) {
			current[segment] = value
		} else {
			current[segment] = current[segment] ?? {}
			current = current[segment]
		}
	})

	return target
}

function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}
