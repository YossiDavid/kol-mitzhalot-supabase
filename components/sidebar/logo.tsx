"use client"

import { SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import Link from "next/link"
import LogoIcon from "@/assets/images/logo_negative.svg"
import Logo from "@/assets/images/logo_negative_text.svg"

export function SidebarLogo() {
	const { state, toggleSidebar } = useSidebar()
	return (
		<SidebarHeader className={cn(state === "collapsed" ? "flex items-center justify-center p-3" : "p-4")}>
			<Link href="/app" className="flex items-center">
				<img
					src={state === "collapsed" ? LogoIcon.src : Logo.src}
					alt="לוגו קול מצהלות"
					className={cn(state === "collapsed" ? "h-8 w-8" : "h-auto w-full")}
				/>
			</Link>
		</SidebarHeader>
	)
}
