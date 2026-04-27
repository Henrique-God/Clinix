const defaultApiUrls = {
  users: "http://52.87.107.79:5001",
  appointments: "http://52.87.107.79:5002",
  chatbot: "http://52.87.107.79:5003",
};

export const apiConfig = {
  usersApiUrl: import.meta.env.VITE_USERS_API_URL ?? defaultApiUrls.users,
  appointmentsApiUrl:
    import.meta.env.VITE_APPOINTMENTS_API_URL ?? defaultApiUrls.appointments,
  chatbotApiUrl:
    import.meta.env.VITE_CHATBOT_API_URL ?? defaultApiUrls.chatbot,
};
