"use client"

import { SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import Link from "next/link"
import LogoIcon from "@/assets/images/logo_negative.svg"
import Logo from "@/assets/images/logo_negative_text.svg"

export function SidebarLogo() {
	const { state, toggleSidebar } = useSidebar()
	return (
		<SidebarHeader className={cn(state === "collapsed" ? "p-4" : "p-4")}>
			<Link href="/app">
				<img
					src={state === "collapsed" ? LogoIcon.src : Logo.src}
					alt="לוגו קול מצהלות"
				/>
			</Link>
		</SidebarHeader>
	)
}
