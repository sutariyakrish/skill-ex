export function isEmailValid(email) {
  return /\S+@\S+\.\S+/.test(String(email).trim());
}

export function isPasswordValid(password) {
  return String(password).trim().length >= 6;
}

export function getPasswordStrength(password) {
  const value = String(password);
  let score = 0;

  if (value.length >= 6) {
    score += 1;
  }
  if (value.length >= 10) {
    score += 1;
  }
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) {
    score += 1;
  }
  if (/\d/.test(value)) {
    score += 1;
  }
  if (/[^A-Za-z0-9]/.test(value)) {
    score += 1;
  }

  if (!value) {
    return { score: 0, label: "Add a password", tone: "neutral" };
  }
  if (score <= 2) {
    return { score, label: "Weak", tone: "danger" };
  }
  if (score === 3 || score === 4) {
    return { score, label: "Medium", tone: "warning" };
  }
  return { score, label: "Strong", tone: "success" };
}

export function validateLoginForm({ email, password }) {
  if (!isEmailValid(email)) {
    return "Enter a valid email address.";
  }

  if (!password) {
    return "Enter your password.";
  }

  return "";
}

export function validateSignupForm({ name, email, password, languages }) {
  if (!name.trim()) {
    return "Enter your full name.";
  }

  if (!isEmailValid(email)) {
    return "Enter a valid email address.";
  }

  if (!isPasswordValid(password)) {
    return "Password must be at least 6 characters.";
  }

  if (!languages.length) {
    return "Select at least one language.";
  }

  return "";
}

export function validateSignupStep(step, form) {
  if (step === 1) {
    if (!form.name.trim()) {
      return "Enter your full name.";
    }
    if (!isEmailValid(form.email)) {
      return "Enter a valid email address.";
    }
    if (!isPasswordValid(form.password)) {
      return "Password must be at least 6 characters.";
    }
  }

  if (step === 2 && !form.emailVerified) {
    return "Verify your email to continue.";
  }

  if (step === 3 && !form.userType) {
    return "Choose whether you're a student or a general user.";
  }

  if (step === 4 && form.userType === "Student" && !form.institution.trim()) {
    return "Enter your school, college, or institute name.";
  }

  if (step === 5) {
    const { country, state, city, pincode } = form.location;
    if (!country.trim() || !state.trim() || !city.trim() || !pincode.trim()) {
      return "Complete your location before continuing.";
    }
  }

  if (step === 6 && !form.languages.length) {
    return "Select at least one language.";
  }

  return "";
}

export function validateListingForm({ title, description, listingType, creditPrice }) {
  const safeTitle = String(title ?? "").trim();
  const safeDescription = String(description ?? "").trim();

  if (!safeTitle) {
    return "A listing title is required.";
  }

  if (!safeDescription) {
    return "Add a short description so buyers know what you offer.";
  }

  if (!listingType) {
    return "Choose a listing type.";
  }

  if (creditPrice === "" || creditPrice === null || creditPrice === undefined) {
    return "Enter a credit price.";
  }

  return "";
}

export function validateMeetingForm({ participantId, topic, scheduledAt, link }) {
  if (!participantId) {
    return "Choose who the meeting is with.";
  }

  if (!topic.trim()) {
    return "Enter a meeting topic.";
  }

  if (!scheduledAt) {
    return "Pick a date and time.";
  }

  if (!link.trim()) {
    return "Add a meeting link.";
  }

  return "";
}

export function validateProfileForm({ name, email, languages }) {
  if (!name.trim()) {
    return "Name cannot be empty.";
  }

  if (!isEmailValid(email)) {
    return "Enter a valid email address.";
  }

  if (!languages.length) {
    return "Choose at least one language.";
  }

  return "";
}
