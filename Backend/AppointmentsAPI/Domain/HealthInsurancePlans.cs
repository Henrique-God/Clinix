namespace AppointmentsAPI.Domain;

public static class HealthInsurancePlans
{
    public static readonly IReadOnlyList<string> All = new[]
    {
        "Unimed", "Amil", "SulAmérica", "Bradesco Saúde",
        "NotreDame Intermédica", "Hapvida", "São Francisco",
        "Porto Seguro Saúde", "Prevent Senior", "Golden Cross"
    };
}
