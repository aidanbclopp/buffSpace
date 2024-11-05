
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    form.addEventListener("submit", (event) => {
        event.preventDefault(); // Prevents default form submission

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // Clear any existing messages
        let errorMessage = document.querySelector("#errorMessage");
        if (!errorMessage) {
            errorMessage = document.createElement("p");
            errorMessage.id = "errorMessage";
            errorMessage.style.color = "red";
            form.prepend(errorMessage);
        }

        // Basic validation
        if (!username || !password) {
            errorMessage.textContent = "Both fields are required.";
            return;
        }

        // Placeholder for actual validation logic (e.g., API request)
        if (username === "admin" && password === "password") {
            alert("Login successful!");
            errorMessage.textContent = ""; // Clear any previous errors
            // Perform actions on successful login (e.g., redirect)
            // window.location.href = "/dashboard";
        } else {
            errorMessage.textContent = "Invalid username or password.";
        }
    });
});
