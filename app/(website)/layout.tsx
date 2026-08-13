import Footer from "@/components/layout/footer"
import Header from "@/components/layout/header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Suspense } from "react"

export default async function WebsiteLayout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider>
			<div className="site-marketing flex flex-1 flex-col">
				<Suspense fallback={<div className="border-b-foreground/10 shell-site flex h-16 items-center justify-between border-b" />}>
					<Header variant="website" />
				</Suspense>
				<main className="flex-1">{children}</main>
				<Suspense fallback={<div className="border-t-foreground/10 shell-site flex min-h-16 items-center justify-between border-t" />}>
					<Footer variant="website" />
				</Suspense>
			</div>
		</SidebarProvider>
	)
}

