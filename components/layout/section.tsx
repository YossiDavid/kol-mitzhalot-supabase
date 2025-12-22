import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export type SectionProps = React.ComponentPropsWithoutRef<"section"> & {
	asChild?: boolean
	full?: boolean
	containerClassName?: string
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
	(
		{ asChild, full, className, containerClassName, children, ...props },
		ref
	) => {
		const Comp = asChild ? Slot : "section"

		return (
			<Comp ref={ref} className={cn(className)} {...props}>
				{!full ? (
					<div className={cn("container", containerClassName)}>
						{children}
					</div>
				) : (
					children
				)}
			</Comp>
		)
	}
)

Section.displayName = "Section"

export default Section
