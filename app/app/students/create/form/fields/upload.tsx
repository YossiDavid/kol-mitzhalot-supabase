"use client"

import {
	Dropzone,
	DropzoneContent,
	DropzoneEmptyState,
} from "@/components/ui/shadcn-io/dropzone"
import { useEffect, useState } from "react"

import type { UploadField } from "../fileds-data"
import { Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

import PDF from "@/assets/icons/pdf.svg"

type PreviewFile = {
	url: string
	name: string
	size: number
	fileType: "image" | "pdf" | "other"
}
const DEFAULT_MAX_FILES = 3

type UploadProps = {
	value?: File[]
	onChange?: (files: File[]) => void
	multiple?: boolean
	maxFiles?: number
} & Pick<UploadField, "accept">

export default function Upload({
	accept,
	value,
	onChange,
	multiple = true,
	maxFiles = DEFAULT_MAX_FILES,
}: UploadProps) {
	const [internalFiles, setInternalFiles] = useState<File[]>([])
	const files = value ?? internalFiles
	const [previews, setPreviews] = useState<PreviewFile[]>([])

	// צור / נקה ObjectURLs בכל שינוי בקבצים
	useEffect(() => {
		const next =
			files?.map((file) => {
				const fileType: PreviewFile["fileType"] = file.type?.startsWith(
					"image/"
				)
					? "image"
					: file.type === "application/pdf"
					? "pdf"
					: "other"

				return {
					url: URL.createObjectURL(file),
					name: file.name,
					size: file.size,
					fileType,
				}
			}) ?? []
		setPreviews(next)

		return () => {
			next.forEach((preview) => URL.revokeObjectURL(preview.url))
		}
	}, [files])

	const handleDrop = (accepted: File[]) => {
		const limit = multiple ? maxFiles : 1
		const limited = accepted.slice(0, limit)

		if (onChange) {
			onChange(limited)
		} else {
			setInternalFiles(limited)
		}
	}

	const dropzoneFiles = files && files.length > 0 ? files : undefined

	return (
		<div className="relative">
			{files.length > 0 && (
				<Button
					onClick={() => {
						// Clear controlled value if provided, otherwise clear internal state
						if (onChange) {
							onChange([])
						}
						setInternalFiles([])
						setPreviews([])
					}}
					aria-label="איפוס קבצים"
					title="איפוס קבצים"
					className="absolute z-10 top-1 right-1"
				>
					<Trash />
				</Button>
			)}
			<Dropzone
				accept={accept}
				multiple={multiple}
				maxFiles={multiple ? maxFiles : 1}
				onDrop={handleDrop}
				onDropRejected={(rej) => console.error("Rejected:", rej)}
				onError={console.error}
				src={dropzoneFiles}
			>
				<DropzoneEmptyState />

				<DropzoneContent className="relative min-h-[140px] overflow-auto">
					{previews.length > 0 && (
						<div className="flex w-full gap-3 p-3">
							{previews.map((file, index) => (
								<div
									key={file.url}
									className="relative h-[110px] w-full overflow-hidden rounded border bg-muted/10"
									title={file.name}
								>
									{file.fileType === "image" && (
										<img
											alt={file.name}
											src={file.url}
											className="absolute inset-0 h-full w-full object-cover"
										/>
									)}

									{file.fileType === "pdf" && (
										<Image
											alt={file.name}
											src={PDF.src}
											width={40}
											height={40}
											className="p-4 bg-red-50 absolute inset-0 h-full w-full object-contain"
										/>
									)}
								</div>
							))}
						</div>
					)}
				</DropzoneContent>
			</Dropzone>
		</div>
	)
}
