import { AlertTriangleIcon, CheckCircle2Icon, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type Props = {
	issues?: string[]
	status?: "ok"
	onClose?: () => void
}

export default function ShiduchAlert({ issues, status, onClose }: Props) {
	return (
		<div className="w-full p-6 flex justify-center">
			<div className="w-full max-w-lg">
				{issues && (
					<Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400">
						<Button
							onClick={onClose}
							variant={"ghost"}
							size={"icon"}
							className="absolute top-1 left-1 hover:bg-transparent"
						>
							<X />
						</Button>
						<AlertTriangleIcon />
						<AlertTitle>
							זיהינו כמה נקודות שכדאי לשים לב אליהם לפני שליחת
							ההצעה:
						</AlertTitle>
						<AlertDescription className="text-yellow-700 dark:text-yellow-300">
							<ul className="list-disc list-inside space-y-1 mt-2">
								{issues?.map((issue, index) => (
									<li key={index}>{issue}</li>
								))}
							</ul>
						</AlertDescription>
					</Alert>
				)}
				{status === "ok" && (
					<Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200 [&>svg]:text-green-600 dark:[&>svg]:text-green-400">
						<CheckCircle2Icon />
						<AlertTitle>
							לא נמצאו בעיות בשידוך, אפשר לשלוח הצעה בביטחון!
						</AlertTitle>
						<AlertDescription className="text-primary dark:text-primary/80">
							יישר כח על השימוש במערכת ועל המאמץ להקים עוד בית
							בישראל!
						</AlertDescription>
					</Alert>
				)}
			</div>
		</div>
	)
}
