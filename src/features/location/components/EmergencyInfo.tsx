import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PhoneIcon from "@mui/icons-material/Phone";
import ShieldIcon from "@mui/icons-material/Shield";
import FavoriteIcon from "@mui/icons-material/Favorite";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import SailingIcon from "@mui/icons-material/Sailing";
import TerrainIcon from "@mui/icons-material/Terrain";
import type { ReactNode } from "react";
import type { EmergencyNumbers } from "@/features/location/lib/geolocation";
import type { UserProfile } from "@/shared/types/weather";

interface EmergencyInfoProps {
  emergencyNumbers: EmergencyNumbers;
  profile: UserProfile;
  locationName: string;
  countryCode: string;
}

interface Contact {
  icon: ReactNode;
  label: string;
  number: string;
  description: string;
  primary?: boolean;
}

export function EmergencyInfo({
  emergencyNumbers,
  profile,
  locationName,
  countryCode,
}: EmergencyInfoProps) {
  /**
   * Dialling only does something on a device with a phone. On desktop a `tel:`
   * link is inert, so the number is shown as text too — it is the part that
   * actually matters in an emergency.
   */
  const call = (number: string) => {
    window.location.href = `tel:${number.replace(/[^0-9+]/g, "")}`;
  };

  const contacts: Contact[] = [
    {
      icon: <ShieldIcon />,
      label: "Emergency",
      number: emergencyNumbers.general,
      description: "General emergency services",
      primary: true,
    },
  ];

  if (profile === "marine" && emergencyNumbers.maritime) {
    contacts.push({
      icon: <SailingIcon />,
      label: "Maritime rescue",
      number: emergencyNumbers.maritime,
      description: "Coast guard and sea rescue",
      primary: true,
    });
  }

  if (profile === "mountain" && emergencyNumbers.mountain) {
    contacts.push({
      icon: <TerrainIcon />,
      label: "Mountain rescue",
      number: emergencyNumbers.mountain,
      description: "Alpine and mountain emergency",
      primary: true,
    });
  }

  contacts.push(
    {
      icon: <FavoriteIcon />,
      label: "Medical",
      number: emergencyNumbers.medical,
      description: "Ambulance and medical emergency",
    },
    {
      icon: <LocalFireDepartmentIcon />,
      label: "Fire",
      number: emergencyNumbers.fire,
      description: "Fire department",
    },
    {
      icon: <PhoneIcon />,
      label: "Police",
      number: emergencyNumbers.police,
      description: "Police emergency",
    },
  );

  return (
    <Card variant="outlined" sx={{ borderColor: "error.main", borderWidth: 2 }}>
      <CardHeader
        title={`Emergency contacts — ${locationName}`}
        subheader={
          countryCode !== "DEFAULT"
            ? `${countryCode} emergency services`
            : "International fallback numbers"
        }
        slotProps={{
          title: { variant: "h6", component: "h2", color: "error" },
        }}
      />
      <CardContent>
        {countryCode === "DEFAULT" && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This country is not in our table, so these are the international
            fallback numbers. Verify them locally before you need them.
          </Alert>
        )}

        <Stack spacing={1.5}>
          {contacts.map((contact) => (
            <Stack
              key={contact.label}
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                {contact.icon}
                <div>
                  <Typography sx={{ fontWeight: 600 }}>
                    {contact.label}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {contact.description}
                  </Typography>
                </div>
              </Stack>

              <Button
                variant={contact.primary ? "contained" : "outlined"}
                color="error"
                size="small"
                startIcon={<PhoneIcon />}
                onClick={() => call(contact.number)}
              >
                {contact.number}
              </Button>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
