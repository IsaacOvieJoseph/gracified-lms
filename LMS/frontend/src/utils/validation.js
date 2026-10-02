/**
 * Validates an email address using a regular expression.
 * @param {string} email - The email address to validate.
 * @returns {boolean} - True if the email is valid, false otherwise.
 */
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validates a password based on strict criteria:
 * - At least 6 characters long
 * - Contains at least one letter
 * - Contains at least one number
 * - Contains at least one special character
 * @param {string} password - The password to validate.
 * @returns {boolean} - True if the password meets the criteria, false otherwise.
 */
export const validatePassword = (password) => {
    // Min 6 chars, at least 1 letter, 1 number, and 1 special char
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{6,}$/;
    return passwordRegex.test(password);
};

export const passwordRequirements = "Password must be at least 6 characters long and include at least one letter, one number, and one special character.";
