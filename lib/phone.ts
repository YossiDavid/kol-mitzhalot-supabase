const IL_LOCAL_REGEX = /^05\d{8}$/
const IL_INTL_REGEX = /^9725\d{8}$/
const IL_PLUS_REGEX = /^\+9725\d{8}$/

export function normalizePhoneKey(phone: string) {
	return phone.replace(/\D+/g, "")
}

export function maskPhone(phone: string) {
	return String(phone).replace(/(\d{3})\d+(\d{2})/, "$1******$2")
}

export function isValidILPhone(phone: string) {
	const value = String(phone).trim()
	return (
		IL_LOCAL_REGEX.test(value) ||
		IL_INTL_REGEX.test(value) ||
		IL_PLUS_REGEX.test(value)
	)
}
