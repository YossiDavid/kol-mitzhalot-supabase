"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import { Controller, FormProvider, useFormContext } from "react-hook-form"

import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue = {
	name: string
}

const FormFieldContext = React.createContext<FormFieldContextValue | undefined>(
	undefined
)

function useFormField() {
	const fieldContext = React.useContext(FormFieldContext)
	const itemContext = React.useContext(FormItemContext)
	const { getFieldState, formState } = useFormContext()

	if (!fieldContext) {
		throw new Error("useFormField should be used within <FormField>")
	}

	const fieldState = getFieldState(fieldContext.name, formState)

	return {
		id: itemContext?.id,
		name: fieldContext.name,
		formItemId: itemContext?.id,
		formDescriptionId: itemContext?.descriptionId,
		formMessageId: itemContext?.messageId,
		...fieldState,
	}
}

type FormFieldProps = React.ComponentProps<typeof Controller>

function FormField({ ...props }: FormFieldProps) {
	return (
		<FormFieldContext.Provider value={{ name: props.name as string }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	)
}

const FormItemContext = React.createContext<{
	id: string
	descriptionId?: string
	messageId?: string
} | null>(null)

const FormItem = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
	const id = React.useId()
	const descriptionId = `${id}-description`
	const messageId = `${id}-message`

	return (
		<FormItemContext.Provider value={{ id, descriptionId, messageId }}>
			<div ref={ref} className={cn("space-y-2", className)} {...props} />
		</FormItemContext.Provider>
	)
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
	React.ElementRef<typeof LabelPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
	const { formItemId } = useFormField()

	return (
		<LabelPrimitive.Root
			ref={ref}
			className={cn(className)}
			htmlFor={formItemId}
			{...props}
		/>
	)
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
	React.ElementRef<typeof Slot>,
	React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
	const { formItemId, formDescriptionId, formMessageId } = useFormField()

	return (
		<Slot
			ref={ref}
			id={formItemId}
			aria-describedby={
				[formDescriptionId, formMessageId].filter(Boolean).join(" ") ||
				undefined
			}
			{...props}
		/>
	)
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
	const { formDescriptionId } = useFormField()

	return (
		<p
			ref={ref}
			id={formDescriptionId}
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	)
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
	const { formMessageId, error } = useFormField()
	const body = error ? String(error.message ?? "שדה לא תקין") : children

	if (!body) {
		return null
	}

	return (
		<p
			ref={ref}
			id={formMessageId}
			className={cn("text-sm font-medium text-destructive", className)}
			{...props}
		>
			{body}
		</p>
	)
})
FormMessage.displayName = "FormMessage"

export {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	useFormField,
}


