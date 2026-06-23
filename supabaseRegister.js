// CompanyManager — Supabase Registration Flow

(function () {
  const planMap = {
    "3m": "3_months",
    "6m": "6_months",
    "12m": "12_months",
    "24m": "24_months"
  };

  const planLabels = {
    "3m": "3 miesiące — 100 PLN netto",
    "6m": "6 miesięcy — 175 PLN netto",
    "12m": "12 miesięcy — 300 PLN netto",
    "24m": "24 miesiące — 500 PLN netto"
  };

  function field(id) {
    return document.getElementById(id);
  }

  function value(id) {
    return (field(id)?.value || "").trim();
  }

  function checked(name) {
    return Boolean(document.querySelector(`input[name="${name}"]:checked`));
  }

  function selectedPlan() {
    return document.querySelector('input[name="pricingPlan"]:checked')?.value || "";
  }

  function setMessage(type, message) {
    const error = field("formError");
    const success = field("formSuccess");

    if (error) {
      error.textContent = "";
      error.style.display = "none";
    }
    if (success) {
      success.textContent = "";
      success.style.display = "none";
    }

    const target = type === "success" ? success : error;
    if (target) {
      target.textContent = message;
      target.style.display = "block";
    } else {
      alert(message);
    }
  }

  function validateBasic() {
    const email = value("email");
    const password = field("password")?.value || "";
    const confirmPassword = field("confirmPassword")?.value || "";
    const plan = selectedPlan();

    if (!email || !password || !confirmPassword || !value("ownerName") || !value("companyName")) {
      setMessage("error", "Uzupełnij wymagane pola formularza.");
      return false;
    }

    if (password.length < 8) {
      setMessage("error", "Hasło musi mieć minimum 8 znaków.");
      return false;
    }

    if (password !== confirmPassword) {
      setMessage("error", "Hasła nie są takie same.");
      return false;
    }

    if (!plan || !planMap[plan]) {
      setMessage("error", "Wybierz pakiet cenowy.");
      return false;
    }

    if (!checked("acceptTerms") || !checked("acceptRodo") || !checked("acceptPrivacy")) {
      setMessage("error", "Zaakceptuj wymagane dokumenty.");
      return false;
    }

    return true;
  }

  function buildRegistrationRpcPayload() {
    const plan = selectedPlan();

    return {
      p_email: value("email").toLowerCase(),
      p_full_name: value("ownerName"),
      p_phone: value("phone"),
      p_company_name: value("companyName"),
      p_company_address: value("companyAddress"),
      p_company_postal_code: value("postalCode"),
      p_company_city: value("city"),
      p_company_phone: value("receptionPhones"),
      p_company_email: value("receptionEmail") || value("email").toLowerCase(),
      p_invoice_name: value("billingName"),
      p_invoice_address: value("billingAddress"),
      p_invoice_postal_code: value("billingPostal"),
      p_invoice_city: value("billingCity"),
      p_nip_vat: value("nip"),
      p_package: planMap[plan]
    };
  }

  async function handleRegister(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    if (!window.cmSupabase) {
      setMessage("error", "Brak połączenia z Supabase. Sprawdź supabaseClient.js.");
      return;
    }

    if (!validateBasic()) return;

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent || "Utwórz konto firmy";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Wysyłam zgłoszenie...";
    }

    try {
      const email = value("email").toLowerCase();
      const password = field("password")?.value || "";
      const fullName = value("ownerName");
      const phone = value("phone");

      const { data: signUpData, error: signUpError } = await window.cmSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            company_name: value("companyName")
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!signUpData?.user?.id) {
        throw new Error("Nie udało się utworzyć użytkownika Supabase Auth.");
      }

      const payload = buildRegistrationRpcPayload();
      const { error: requestError } = await window.cmSupabase.rpc(
        "create_company_registration_request_public",
        payload
      );

      if (requestError) {
        throw requestError;
      }

      await window.cmSupabase.auth.signOut();

      form.reset();
      setMessage("success", "Zgłoszenie rejestracji zostało wysłane do właściciela platformy. Po zatwierdzeniu firma otrzyma dostęp do panelu.");

      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 1800);
    } catch (error) {
      const rawMessage = error?.message || String(error);
      const friendlyMessage = rawMessage.toLowerCase().includes("already registered") || rawMessage.toLowerCase().includes("already exists")
        ? "Konto z takim adresem email już istnieje albo oczekuje na zatwierdzenie."
        : rawMessage;
      setMessage("error", "Błąd rejestracji: " + friendlyMessage);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form) return;

    // Capture + stopImmediatePropagation blokuje stary zapis localStorage z app.js.
    form.addEventListener("submit", handleRegister, true);
  });
})();
