import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TEXT_FIELD_TYPES, type TextField } from "../fileds-data"
import React from "react"
import { Switch } from "@/components/ui/switch"

type TextFieldProps = React.ComponentProps<"input"> & {
	type: TextField["type"]
}

export function TextField({ type, ...props }: TextFieldProps) {
	if (type !== "textarea" && type !== "switch" && type !== "date") {
		return <Input type={type === "number" ? "number" : "text"} {...props} />
	}

	if (type === "textarea") {
		return <Textarea />
	}

	if (type === "switch") {
		return <Switch />
	}
}
