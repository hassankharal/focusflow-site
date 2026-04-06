(() => {
  const WAITLIST_LIMIT = 25;
  const launchOverride = Number.parseInt(
    new URLSearchParams(window.location.search).get("launchTs"),
    10
  );
  // July 1, 2026 00:00:00 in America/Winnipeg (CDT, UTC-5) == 2026-07-01T05:00:00Z
  const LAUNCH_AT_MS = Number.isFinite(launchOverride)
    ? launchOverride
    : Date.UTC(2026, 6, 1, 5, 0, 0);

  const countdownGrid = document.getElementById("countdown-grid");
  const releaseState = document.getElementById("release-state");
  const dayEl = document.getElementById("time-days");
  const hourEl = document.getElementById("time-hours");
  const minuteEl = document.getElementById("time-minutes");
  const secondEl = document.getElementById("time-seconds");

  const waitlistForm = document.getElementById("waitlist-form");
  const waitlistStatus = document.getElementById("waitlist-status");
  const waitlistHelper = document.getElementById("waitlist-helper");
  const submitButton = document.getElementById("waitlist-submit");

  const spotsEls = document.querySelectorAll("[data-spots-remaining]");
  const offerCopyEls = document.querySelectorAll("[data-offer-copy]");
  const offerStateEls = document.querySelectorAll("[data-offer-state]");
  const launchCtas = document.querySelectorAll("[data-launch-cta]");

  let pollingTimer = null;

  function formatNumber(value, minDigits = 2) {
    return String(Math.max(0, value)).padStart(minDigits, "0");
  }

  function setReleasedState(isReleased) {
    document.body.classList.toggle("is-released", isReleased);

    if (countdownGrid) {
      countdownGrid.hidden = isReleased;
    }

    if (releaseState) {
      releaseState.hidden = !isReleased;
    }

    launchCtas.forEach((link) => {
      const defaultLabel = link.dataset.defaultLabel;
      const releasedLabel = link.dataset.releasedLabel;
      if (isReleased && releasedLabel) {
        link.textContent = releasedLabel;
      } else if (!isReleased && defaultLabel) {
        link.textContent = defaultLabel;
      }
    });
  }

  function tickCountdown() {
    if (!dayEl || !hourEl || !minuteEl || !secondEl) {
      return;
    }

    const now = Date.now();
    const diff = LAUNCH_AT_MS - now;

    if (diff <= 0) {
      dayEl.textContent = "00";
      hourEl.textContent = "00";
      minuteEl.textContent = "00";
      secondEl.textContent = "00";
      setReleasedState(true);
      return;
    }

    setReleasedState(false);

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    dayEl.textContent = formatNumber(days, 2);
    hourEl.textContent = formatNumber(hours, 2);
    minuteEl.textContent = formatNumber(minutes, 2);
    secondEl.textContent = formatNumber(seconds, 2);
  }

  function setFormStatus(type, message) {
    if (!waitlistStatus) {
      return;
    }

    waitlistStatus.className = "form-status";

    if (!message) {
      waitlistStatus.textContent = "";
      return;
    }

    waitlistStatus.classList.add(type);
    waitlistStatus.textContent = message;
  }

  function setSubmitLoading(isLoading) {
    if (!submitButton) {
      return;
    }

    const loadingLabel = submitButton.dataset.loadingLabel || "Submitting...";
    const defaultLabel = submitButton.dataset.defaultLabel || "Join the waitlist";

    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? loadingLabel : defaultLabel;
  }

  function updateOfferCopy(spotsRemaining) {
    const safeRemaining = Number.isFinite(spotsRemaining)
      ? Math.max(0, Math.floor(spotsRemaining))
      : WAITLIST_LIMIT;

    spotsEls.forEach((el) => {
      el.textContent = String(safeRemaining);
    });

    const offerClaimed = safeRemaining <= 0;
    document.body.classList.toggle("offer-claimed", offerClaimed);

    offerStateEls.forEach((el) => {
      el.textContent = offerClaimed ? "Founding offer fully claimed" : "Founding offer available";
    });

    offerCopyEls.forEach((el) => {
      if (offerClaimed) {
        el.innerHTML = "Founding offer is fully claimed. Join the waitlist for launch access and future updates.";
      } else {
        el.innerHTML = "<strong>" + safeRemaining + " of " + WAITLIST_LIMIT + "</strong> founding spots remaining.";
      }
    });
  }

  async function fetchWaitlistStatus() {
    try {
      const response = await fetch("/api/waitlist-status", {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Status request failed");
      }

      const data = await response.json();

      if (typeof data.spots_remaining === "number") {
        updateOfferCopy(data.spots_remaining);
      }

      if (waitlistHelper && data.configured === false) {
        waitlistHelper.textContent = "Waitlist backend is not configured yet. Set Supabase env vars to enable live signups.";
      }
    } catch (error) {
      if (waitlistHelper) {
        waitlistHelper.textContent = "Live offer count could not refresh right now. You can still submit the form.";
      }
    }
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function submitWaitlist(event) {
    event.preventDefault();

    if (!waitlistForm) {
      return;
    }

    const formData = new FormData(waitlistForm);
    const email = String(formData.get("email") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const company = String(formData.get("company") || "").trim();

    if (!validEmail(email)) {
      setFormStatus("error", "Enter a valid email address.");
      return;
    }

    setSubmitLoading(true);
    setFormStatus("info", "Reserving your place...");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          email,
          name,
          company,
          source: "focusflow-landing",
          metadata: {
            page: window.location.pathname
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true) {
        setFormStatus("error", data.message || "Could not join the waitlist. Please try again.");
        return;
      }

      const qualified = data.qualified_for_free_year === true;
      const duplicate = data.duplicate === true;
      const rank = typeof data.rank === "number" ? data.rank : null;

      if (duplicate && qualified) {
        setFormStatus("info", "You are already on the waitlist and your free year is secured.");
      } else if (duplicate && !qualified) {
        setFormStatus("info", "You are already on the waitlist. We will share launch updates.");
      } else if (!duplicate && qualified) {
        const rankText = rank ? " (signup #" + rank + ")" : "";
        setFormStatus("success", "You are in. Your 1-year founding offer is secured" + rankText + ".");
        waitlistForm.reset();
      } else {
        setFormStatus("success", "You joined the waitlist. Founding offer spots may already be fully claimed.");
        waitlistForm.reset();
      }

      if (typeof data.spots_remaining === "number") {
        updateOfferCopy(data.spots_remaining);
      }

      await fetchWaitlistStatus();
    } catch (error) {
      setFormStatus("error", "Network issue. Please try again in a moment.");
    } finally {
      setSubmitLoading(false);
    }
  }

  function startOfferPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    pollingTimer = window.setInterval(() => {
      if (!document.hidden) {
        fetchWaitlistStatus();
      }
    }, 45000);
  }

  tickCountdown();
  window.setInterval(tickCountdown, 1000);

  fetchWaitlistStatus();
  startOfferPolling();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      fetchWaitlistStatus();
    }
  });

  if (waitlistForm) {
    waitlistForm.addEventListener("submit", submitWaitlist);
  }
})();
