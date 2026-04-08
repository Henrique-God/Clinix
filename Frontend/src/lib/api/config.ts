const defaultApiUrls = {
  users: "http://localhost:5001",
  appointments: "http://localhost:5002",
  chatbot: "http://localhost:5003",
};

export const apiConfig = {
  usersApiUrl: import.meta.env.VITE_USERS_API_URL ?? defaultApiUrls.users,
  appointmentsApiUrl:
    import.meta.env.VITE_APPOINTMENTS_API_URL ?? defaultApiUrls.appointments,
  chatbotApiUrl:
    import.meta.env.VITE_CHATBOT_API_URL ?? defaultApiUrls.chatbot,
};
