namespace UsersAPI.Models.DTOs;

public class CreateCheckoutRequestDTO
{
    public string SuccessUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
}
