const BOOKING_KEY = "boundaryBoxBookings";
const SLOT_MINUTES = 30;

// Edit these values later to match your actual turf opening hours and pricing.
const OPEN_TIME = "06:00";
const CLOSE_TIME = "23:00";
const SLOT_PRICE = 0; // Set e.g. 350 when you want to show a price.

let dates = [];
let selectedDate = null;
let selectedSlots = [];

const dateGrid = document.getElementById("dateGrid");
const slotGrid = document.getElementById("slotGrid");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const bookingSummary = document.getElementById("bookingSummary");
const bookingForm = document.getElementById("bookingForm");
const confirmButton = document.getElementById("confirmButton");
const monthTitle = document.getElementById("monthTitle");

document.getElementById("year").textContent = new Date().getFullYear();

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createNext14Days() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
}

function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options
  }).format(date);
}

function renderDates() {
  dateGrid.innerHTML = `
    <div class="weekday">SUN</div>
    <div class="weekday">MON</div>
    <div class="weekday">TUE</div>
    <div class="weekday">WED</div>
    <div class="weekday">THU</div>
    <div class="weekday">FRI</div>
    <div class="weekday">SAT</div>
  `;

  // Empty cells so the first date sits on the correct English calendar weekday.
  const firstDay = dates[0].getDay();
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    dateGrid.appendChild(blank);
  }

  dates.forEach((date) => {
    const key = localDateKey(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-button";
    if (key === localDateKey(new Date())) button.classList.add("today");
    if (selectedDate && key === localDateKey(selectedDate)) button.classList.add("selected");

    button.innerHTML = `
      <span class="day-name">${new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date)}</span>
      <span class="day-number">${date.getDate()}</span>
      <span class="month-name">${new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date)}</span>
    `;

    button.addEventListener("click", () => selectDate(date));
    dateGrid.appendChild(button);
  });

  monthTitle.textContent = formatDate(dates[0], { month: "long", year: "numeric" });
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function generateSlots() {
  const slots = [];
  for (
    let time = timeToMinutes(OPEN_TIME);
    time + SLOT_MINUTES <= timeToMinutes(CLOSE_TIME);
    time += SLOT_MINUTES
  ) {
    slots.push({
      start: minutesToTime(time),
      end: minutesToTime(time + SLOT_MINUTES),
      key: `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`
    });
  }
  return slots;
}

function getBookings() {
  try {
    return JSON.parse(localStorage.getItem(BOOKING_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBookings(bookings) {
  localStorage.setItem(BOOKING_KEY, JSON.stringify(bookings));
}

function selectDate(date) {
  selectedDate = date;
  selectedSlots = [];
  renderDates();
  renderSlots();
  updateSummary();
}

function toggleSlot(slotKey) {
  const allSlots = generateSlots().map(slot => slot.key);

  if (selectedSlots.length === 0) {
    selectedSlots = [slotKey];
  } else if (selectedSlots.includes(slotKey)) {
    selectedSlots = selectedSlots.filter(key => key !== slotKey);
    selectedSlots = normalizeContinuousSelection(selectedSlots, allSlots);
  } else {
    const indexes = selectedSlots.map(key => allSlots.indexOf(key));
    const newIndex = allSlots.indexOf(slotKey);
    const minIndex = Math.min(...indexes);
    const maxIndex = Math.max(...indexes);

    if (newIndex === minIndex - 1) selectedSlots.unshift(slotKey);
    else if (newIndex === maxIndex + 1) selectedSlots.push(slotKey);
    else {
      alert("Please select continuous slots only. To start at a different time, clear the current selection first.");
      return;
    }
  }

  renderSlots();
  updateSummary();
}

function normalizeContinuousSelection(selection, allSlots) {
  if (selection.length <= 1) return selection;
  const indexes = selection.map(key => allSlots.indexOf(key)).filter(i => i >= 0).sort((a,b) => a-b);
  const continuous = [];
  for (let i = 0; i < indexes.length; i++) {
    if (i === 0 || indexes[i] === indexes[i - 1] + 1) continuous.push(allSlots[indexes[i]]);
    else break;
  }
  return continuous;
}

function renderSlots() {
  if (!selectedDate) {
    slotGrid.innerHTML = "<p style='color:#89968f'>Choose a date to view available slots.</p>";
    return;
  }

  const dateKey = localDateKey(selectedDate);
  const bookings = getBookings();
  const bookedSlots = bookings[dateKey] || [];

  selectedDateLabel.textContent = formatDate(selectedDate, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  slotGrid.innerHTML = "";

  generateSlots().forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot";
    const isBooked = bookedSlots.includes(slot.key);

    if (isBooked) {
      button.classList.add("booked");
      button.disabled = true;
      button.textContent = `${slot.start} – Booked`;
    } else {
      button.textContent = `${slot.start} – ${slot.end}`;
      if (selectedSlots.includes(slot.key)) button.classList.add("selected");
      button.addEventListener("click", () => toggleSlot(slot.key));
    }

    slotGrid.appendChild(button);
  });
}

function updateSummary() {
  if (!selectedDate || selectedSlots.length === 0) {
    bookingSummary.textContent = "Select a date and one or more continuous slots to continue.";
    confirmButton.disabled = true;
    return;
  }

  const slots = generateSlots();
  const firstSlot = slots.find(item => item.key === selectedSlots[0]);
  const lastSlot = slots.find(item => item.key === selectedSlots[selectedSlots.length - 1]);
  const duration = selectedSlots.length * SLOT_MINUTES;
  bookingSummary.innerHTML = `<strong>${formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong> · ${firstSlot.start} – ${lastSlot.end} · ${duration} minutes ${SLOT_PRICE > 0 ? `· ₹${SLOT_PRICE * selectedSlots.length}` : ""}`;
  confirmButton.disabled = false;
}

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedDate || selectedSlots.length === 0) return;

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  if (!name || !phone) return;

  const bookings = getBookings();
  const dateKey = localDateKey(selectedDate);
  if (!bookings[dateKey]) bookings[dateKey] = [];

  const conflict = selectedSlots.some(key => bookings[dateKey].includes(key));
  if (conflict) {
    alert("Sorry, one or more selected slots were just booked. Please choose another continuous slot range.");
    selectedSlots = [];
    renderSlots();
    updateSummary();
    return;
  }

  bookings[dateKey].push(...selectedSlots);
  bookings[dateKey] = [...new Set(bookings[dateKey])];
  saveBookings(bookings);

  const slots = generateSlots();
  const firstSlot = slots.find(item => item.key === selectedSlots[0]);
  const lastSlot = slots.find(item => item.key === selectedSlots[selectedSlots.length - 1]);
  const duration = selectedSlots.length * SLOT_MINUTES;

  alert(`Booking confirmed!\n\n${name}\n${formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}\n${firstSlot.start} – ${lastSlot.end}\nDuration: ${duration} minutes\n\nDemo booking only — connect a backend before accepting real payments.`);

  bookingForm.reset();
  selectedSlots = [];
  renderSlots();
  updateSummary();
});

// Mobile navigation
document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("open");
});

document.querySelectorAll("#mainNav a").forEach((link) => {
  link.addEventListener("click", () => document.getElementById("mainNav").classList.remove("open"));
});

// Initialize
dates = createNext14Days();
selectedDate = dates[0];
renderDates();
renderSlots();
updateSummary();
