import { createClient } from "@/lib/supabase/server"
import { Box } from "@/components/layout"

export default async function StudentsList() {
	const supabase = await createClient()
	const { data, error } = await supabase.from("students").select("*")

	if (!data || error) {
		return <div>שגיאה בטעינה</div>
	}

	return (
		<>
			{data.map((item) => (
				<Box key={item.id}>{item.title}</Box>
			))}
		</>
	)
}
