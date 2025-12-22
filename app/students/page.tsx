"use client"

import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Box, Section } from "@/components/layout"
import { cn } from "@/lib/utils"
import { studentFields } from "@/app/app/students/create/form/fileds-data"
import { DynamicField } from "@/app/app/students/create/form/fields/dynamic-field"
import { createClient } from "@/lib/supabase/client"

type Step = (typeof studentFields)[number]

const defaultValues = {
	isOnShiduchim: true,
	gender: "",
	firstName: "",
	lastName: "",
	identityNumber: "",
	birthDate: "",
	image: {
		file: null as File | null,
	},
	country: "",
	city: "",
	street: "",
	house: "",
	community: "",
	shtible: "",
	personalStatus: "",
	height: "",
	cellphoneType: "",
	phone: "",
	planForLife: "",
	headCoverType: "",
	about: "",
	cv: {
		file: null as File | null,
	},
	father: {
		self: { prefix: "", name: "", suffix: "" },
		phone: "",
		job: "",
		email: "",
		grandFather: { prefix: "", name: "", suffix: "" },
		grandMother: { prefix: "", name: "", suffix: "" },
	},
	mother: {
		self: { prefix: "", name: "", suffix: "" },
		maidenName: "",
		phone: "",
		job: "",
		email: "",
		grandFather: { prefix: "", name: "", suffix: "" },
		grandMother: { prefix: "", name: "", suffix: "" },
	},
	family: {
		numberOfChildren: "",
		currentChildPlace: "",
		about: "",
		mechutanim: [] as Array<{
			id?: string
			firstName?: string
			lastName?: string
			city?: string
		}>,
	},
	education: {
		yeshivaKtana: [] as Array<{
			id?: string
			name?: string
			community?: string
			city?: string
		}>,
		yeshivaGdola: [] as Array<{
			id?: string
			name?: string
			community?: string
			city?: string
		}>,
		kolel: [] as Array<{
			id?: string
			name?: string
			community?: string
			city?: string
		}>,
		seminar: [] as Array<{
			id?: string
			name?: string
			community?: string
			city?: string
		}>,
	},
	employment: {
		tags: [] as string[],
		yeshiva: "",
		kolel: "",
		seminar: "",
		havruta: {
			with: "",
			where: "",
		},
		working: {
			role: "",
			where: "",
		},
		profession: {
			what: "",
			where: "",
		},
	},
	previousPartners: [] as Array<Record<string, unknown>>,
	knownRabbanim: [] as Array<Record<string, unknown>>,
	knownFriends: [] as Array<Record<string, unknown>>,
	knownFamilyFriends: [] as Array<Record<string, unknown>>,
	parents: {
		status: "",
		holding: "",
		deadParent: "",
		fatherDeathDate: "",
		motherDeathDate: "",
		isMotherRemarried: "",
		newHusbandName: "",
		isFatherRemarried: "",
		newWifeName: "",
	},
	medical: {
		status: "",
		exposureLevel: "",
		details: "",
		documents: [] as File[],
		contactForMoreInfo: "",
		otherContact: [] as Array<Record<string, unknown>>,
		relatedIssuePreference: "",
	},
	partner: {
		ageRange: { min: 18, max: 40 },
		preferredCountry: "",
		specificCountries: [] as Array<Record<string, unknown>>,
		workStatus: "",
		headCoverType: "",
		planForLife: "",
		cellphoneType: "",
		aboutThePartner: "",
		additionalInformation: "",
	},
	author: {
		name: "",
		phone: "",
	},
}

type FormValues = typeof defaultValues

const genderLabelOverrides: Record<string, { male: string; female: string }> = {
	"previousPartners.fullName": {
		male: "שם מלא של האשה הקודמת",
		female: "שם מלא של הבעל הקודם",
	},
	"previousPartners.parents.fathersName": {
		male: "שם האב של האשה",
		female: "שם האב של הבעל",
	},
	"previousPartners.parents.mothersName": {
		male: "שם האם של האשה",
		female: "שם האם של הבעל",
	},
	"previousPartners.childrenNumber": {
		male: "מספר ילדים מנישואין אלו",
		female: "מספר ילדים מנישואין אלו",
	},
	"previousPartners.marriedChildrenNumber": {
		male: "מתוכם נשואים",
		female: "מתוכם נשואות",
	},
}

const genderedStepTitles: Record<string, { male: string; female: string }> = {
	previousPartners: {
		male: "פרטי אשה קודמת",
		female: "פרטי בעל קודם",
	},
	partner: {
		male: "קצת על המיועדת שאתם מחפשים",
		female: "קצת על המיועד שאתם מחפשים",
	},
}

const supabase = createClient()

export default function CreateStudentPage() {
	const [currentStepIndex, setCurrentStepIndex] = useState(0)

	const form = useForm<FormValues>({
		mode: "onChange",
		defaultValues,
	})

	const formValues = form.watch()

	useEffect(() => {
		if (typeof window === "undefined") return
		console.log("Form values changed:", formValues)
	}, [formValues])

	const steps = studentFields
	const currentStep = steps[currentStepIndex]
	const gender = formValues.gender as "male" | "female" | ""
	const isLastStep = currentStepIndex === steps.length - 1

	const canProceedFromCurrentStep = () => {
		if (steps[currentStepIndex]?.name === "intro") {
			const selectedGender = form.getValues("gender")
			if (!selectedGender) {
				form.setError("gender", {
					type: "manual",
					message: "יש לבחור מיועד/מיועדת לפני שממשיכים",
				})
				return false
			}
			form.clearErrors("gender")
		}

		return true
	}

	const handleNextStep = () => {
		if (!canProceedFromCurrentStep()) return
		if (currentStepIndex === steps.length - 1) return
		setCurrentStepIndex((prev) => prev + 1)
	}

	const handlePreviousStep = () => {
		if (currentStepIndex === 0) return
		setCurrentStepIndex((prev) => prev - 1)
	}

	const handleStepClick = (targetIndex: number) => {
		if (targetIndex === currentStepIndex) return
		const movingForward = targetIndex > currentStepIndex
		if (movingForward && !canProceedFromCurrentStep()) {
			return
		}
		setCurrentStepIndex(targetIndex)
	}

	const onSubmit = async (values: FormValues) => {
		console.log("Submit payload:", values)

		// דוגמה בסיסית לשמירה ב-Supabase כ-JSON אחד (תוכל/י להתאים לסכמה שלך):
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser()

		if (authError || !user) {
			console.error("User not authenticated", authError)
			return
		}

		// התאמה בסיסית: טבלה בשם "students" עם עמודות user_id ו-form_data (JSONB)
		const { error } = await supabase.from("students").insert({
			user_id: user.id,
			form_data: values,
		})

		if (error) {
			console.error("Failed saving student form:", error)
		} else {
			console.log("Student form saved successfully")
		}
	}

	if (!currentStep) {
		return null
	}

	return (
		<Section asChild className="my-10 space-y-4">
			<div>
				<h1 className="mb-4 text-3xl font-bold">הוספת קו״ח למערכת</h1>
				<Box className="p-8">
					<div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
						<StepSidebar
							steps={steps}
							currentStepIndex={currentStepIndex}
							onStepClick={handleStepClick}
							gender={gender}
						/>
						<div>
							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-8"
								>
									<div className="space-y-6">
										<h2 className="text-2xl font-semibold">
											{getStepTitle(currentStep, gender)}
										</h2>
										{currentStep.sections.map((section) => (
											<SectionRenderer
												key={section.name}
												section={section}
												form={form}
												values={formValues}
												gender={gender}
											/>
										))}
									</div>

									<div className="flex items-center justify-between gap-4 border-t pt-6">
										<Button
											variant="outline"
											type="button"
											onClick={handlePreviousStep}
											disabled={currentStepIndex === 0}
											className="flex items-center gap-2"
										>
											<ArrowLeft className="size-4 rtl:rotate-180" />
											<span>חזרה</span>
										</Button>

										{isLastStep ? (
											<Button
												type="submit"
												className="flex items-center gap-2"
											>
												<span>שליחה למערכת</span>
											</Button>
										) : (
											<Button
												type="button"
												onClick={handleNextStep}
												className="flex items-center gap-2"
											>
												<span>המשך לשלב הבא</span>
												<ArrowRight className="size-4 rtl:rotate-180" />
											</Button>
										)}
									</div>
								</form>
							</Form>
						</div>
					</div>
				</Box>
			</div>
		</Section>
	)
}

type SectionRendererProps = {
	section: Step["sections"][number]
	form: ReturnType<typeof useForm<FormValues>>
	values: FormValues
	gender: "male" | "female" | ""
}

function SectionRenderer({
	section,
	form,
	values,
	gender,
}: SectionRendererProps) {
	const { control } = form

	if (!section.fields.length || !shouldDisplaySection(section, values)) {
		return null
	}

	return (
		<div className="space-y-4">
			{section.title && (
				<h3 className="text-lg font-semibold">{section.title}</h3>
			)}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-12">
				{section.fields.map((field, index) => (
					<DynamicField
						key={`${field.name}-${index}`}
						field={field as any}
						control={control}
						values={values}
						gender={gender}
						getLabel={getFieldLabel}
					/>
				))}
			</div>
		</div>
	)
}

type StepSidebarProps = {
	steps: typeof studentFields
	currentStepIndex: number
	onStepClick: (index: number) => void
	gender: "male" | "female" | ""
}

function shouldDisplaySection(
	section: Step["sections"][number],
	values: FormValues
) {
	if (!section.condition || section.condition.length === 0) {
		return true
	}

	return section.condition.every((condition) => {
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
			default:
				return true
		}
	})
}

function StepSidebar({
	steps,
	currentStepIndex,
	onStepClick,
	gender,
}: StepSidebarProps) {
	const disableForwardNavigation =
		steps[currentStepIndex]?.name === "intro" && !gender

	return (
		<nav className="space-y-2">
			{steps.map((step, index) => {
				const isActive = index === currentStepIndex
				const isDisabled =
					disableForwardNavigation && index > currentStepIndex
				return (
					<button
						key={step.name}
						type="button"
						onClick={() => onStepClick(index)}
						className={cn(
							"relative w-full rounded-lg px-3 py-2 text-right transition",
							isActive
								? "bg-primary/10 text-primary before:absolute before:top-1/2 before:right-0 before:h-1/2 before:w-1 before:-translate-y-1/2 before:rounded-l-2xl before:bg-primary"
								: "bg-transparent hover:bg-muted/70",
							isDisabled && "cursor-not-allowed opacity-60"
						)}
						disabled={isDisabled}
					>
						{getStepTitle(step, gender)}
					</button>
				)
			})}
		</nav>
	)
}

function getFieldLabel(
	field: Record<string, any>,
	gender: "male" | "female" | ""
) {
	const baseName = normalizePath((field.originalName ?? field.name) as string)
	if (gender !== "male" && gender !== "female") {
		return field.label
	}
	const override = genderLabelOverrides[baseName]
	if (!override) {
		return field.label
	}
	return override[gender] ?? field.label
}

function getStepTitle(step: Step, gender: "male" | "female" | "") {
	if (gender && genderedStepTitles[step.name]) {
		return genderedStepTitles[step.name][gender]
	}
	return step.title
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


