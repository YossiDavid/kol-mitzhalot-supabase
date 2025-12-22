import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

type BoxProps = React.ComponentPropsWithoutRef<"div"> & {
	children: React.ReactNode
	className?: string
	asChild?: boolean
}

const Box = React.forwardRef<HTMLDivElement, BoxProps>(
	({ children, asChild, ...props }, ref) => {
		const Comp = asChild ? Slot : "div"

		return (
			<Comp ref={ref} className={cn("box p-4", props.className)}>
				{children}
			</Comp>
		)
	}
)

Box.displayName = "Box"

export default Box
