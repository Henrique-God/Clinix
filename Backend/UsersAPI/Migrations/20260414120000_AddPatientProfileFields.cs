using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UsersAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE users.""Users"" ADD COLUMN IF NOT EXISTS ""Cpf"" character varying(14);
                ALTER TABLE users.""Users"" ADD COLUMN IF NOT EXISTS ""DateOfBirth"" timestamp with time zone;
                ALTER TABLE users.""Users"" ADD COLUMN IF NOT EXISTS ""HealthInsurance"" character varying(128);
                ALTER TABLE users.""Users"" ADD COLUMN IF NOT EXISTS ""Phone"" character varying(32);
                ALTER TABLE users.""DoctorProfiles"" ADD COLUMN IF NOT EXISTS ""AcceptedInsurancePlans"" character varying(2000);
                ALTER TABLE users.""DoctorProfiles"" ADD COLUMN IF NOT EXISTS ""ConsultationPriceCents"" integer;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Cpf",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "HealthInsurance",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Phone",
                schema: "users",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AcceptedInsurancePlans",
                schema: "users",
                table: "DoctorProfiles");

            migrationBuilder.DropColumn(
                name: "ConsultationPriceCents",
                schema: "users",
                table: "DoctorProfiles");
        }
    }
}
