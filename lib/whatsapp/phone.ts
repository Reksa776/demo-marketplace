/**
 * ==========================================
 * PHONE NUMBER NORMALIZATION
 * ==========================================
 *
 * Normalizes Indonesian phone numbers
 * to WhatsApp JID-compatible format.
 *
 * Supported input formats:
 * - 081234567890
 * - +6281234567890
 * - 6281234567890
 *
 * Output: 6281234567890
 */

/**
 * Normalize an Indonesian phone number
 * to the format required by WhatsApp.
 *
 * Returns null if the number is invalid.
 */
export function normalizePhone(
    raw: string
): string | null {
    if (!raw || typeof raw !== "string") {
        return null;
    }

    // Remove all non-digit characters except leading +
    const cleaned = raw.replace(/[^\d+]/g, "");

    if (!cleaned) {
        return null;
    }

    let digits: string;

    if (cleaned.startsWith("+62")) {
        // +62xxxxxxxx → 62xxxxxxxx
        digits = "62" + cleaned.slice(3);
    } else if (cleaned.startsWith("62")) {
        // 62xxxxxxxx → already correct
        digits = cleaned;
    } else if (cleaned.startsWith("08")) {
        // 08xxxxxxxx → 62xxxxxxxx
        digits = "62" + cleaned.slice(1);
    } else if (cleaned.startsWith("0")) {
        // 0xxxxxxxx → 62xxxxxxxx (general case)
        digits = "62" + cleaned.slice(1);
    } else {
        return null;
    }

    // Validate: must be at least 10 digits (62 + 8 digit number)
    // and at most 15 digits (62 + 13 digit max for WhatsApp)
    if (digits.length < 10 || digits.length > 15) {
        return null;
    }

    // Validate: after country code, must start with valid prefix
    // Indonesian mobile prefixes: 81x, 82x, 85x, 87x, 88x, 89x
    const localNumber = digits.slice(2); // Remove "62"

    if (!/^8\d{8,13}$/.test(localNumber)) {
        return null;
    }

    return digits;
}

/**
 * Convert normalized phone number
 * to WhatsApp JID format.
 *
 * Input: 6281234567890
 * Output: 6281234567890@s.whatsapp.net
 */
export function phoneToJid(
    normalizedPhone: string
): string {
    return `${normalizedPhone}@s.whatsapp.net`;
}

/**
 * Normalize a phone number and return
 * the WhatsApp JID directly.
 *
 * Returns null if invalid.
 */
export function normalizePhoneToJid(
    raw: string
): string | null {
    const normalized = normalizePhone(raw);
    if (!normalized) {
        return null;
    }
    return phoneToJid(normalized);
}

/**
 * Validate if a phone number looks like
 * a valid Indonesian mobile number.
 */
export function isValidIndonesianPhone(
    raw: string
): boolean {
    return normalizePhone(raw) !== null;
}
