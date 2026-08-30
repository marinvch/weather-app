import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Phone, Shield, Heart, Flame, Anchor, Mountain } from 'lucide-react';
import type { EmergencyNumbers } from '@/features/location/lib/geolocation';
import type { WeatherProfile } from '@/shared/theme/profileThemes';

interface EmergencyInfoProps {
  emergencyNumbers: EmergencyNumbers;
  profile: WeatherProfile;
  locationName: string;
  countryCode: string;
  coordinates?: { latitude: number; longitude: number };
  className?: string;
}

export function EmergencyInfo({
  emergencyNumbers,
  profile,
  locationName,
  countryCode,
  coordinates,
  className
}: EmergencyInfoProps) {
  const callNumber = (number: string) => {
    const cleanNumber = number.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleanNumber}`;
  };

  const getProfileSpecificNumbers = () => {
    const numbers = [];

    // Always show general emergency
    numbers.push({
      icon: <Shield className="w-5 h-5" />,
      label: 'Emergency',
      number: emergencyNumbers.general,
      description: 'General emergency services',
      priority: 'high'
    });

    // Add profile-specific numbers
    switch (profile) {
      case 'marine':
        if (emergencyNumbers.maritime) {
          numbers.push({
            icon: <Anchor className="w-5 h-5" />,
            label: 'Maritime Rescue',
            number: emergencyNumbers.maritime,
            description: 'Coast Guard & Sea Rescue',
            priority: 'high'
          });
        }
        break;

      case 'mountain':
        if (emergencyNumbers.mountain) {
          numbers.push({
            icon: <Mountain className="w-5 h-5" />,
            label: 'Mountain Rescue',
            number: emergencyNumbers.mountain,
            description: 'Alpine & Mountain Emergency',
            priority: 'high'
          });
        }
        break;
    }

    // Add other emergency services
    numbers.push(
      {
        icon: <Heart className="w-5 h-5" />,
        label: 'Medical',
        number: emergencyNumbers.medical,
        description: 'Ambulance & Medical Emergency',
        priority: 'medium'
      },
      {
        icon: <Flame className="w-5 h-5" />,
        label: 'Fire',
        number: emergencyNumbers.fire,
        description: 'Fire Department',
        priority: 'medium'
      },
      {
        icon: <Shield className="w-5 h-5" />,
        label: 'Police',
        number: emergencyNumbers.police,
        description: 'Police Emergency',
        priority: 'medium'
      }
    );

    return numbers;
  };

  const emergencyContacts = getProfileSpecificNumbers();

  return (
    <Card className={`${className} border-2 border-red-600 backdrop-blur-sm`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-800">
          <Phone className="w-5 h-5" />
          Emergency Contacts - {locationName}
        </CardTitle>
        <p className="text-sm text-red-600">
          {countryCode !== 'DEFAULT' ? `${countryCode} Emergency Services` : 'International Emergency Services'}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {emergencyContacts.map((contact, index) => (
          <div key={index} className="flex items-center justify-between p-3 border-2 border-gray-300 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full border-2 ${contact.priority === 'high' ? 'border-red-600 text-red-600' : 'border-gray-600 text-gray-600'
                }`}>
                {contact.icon}
              </div>
              <div>
                <p className="font-medium text-gray-900">{contact.label}</p>
                <p className="text-sm text-gray-600">{contact.description}</p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => callNumber(contact.number)}
              className={`border-2 ${contact.priority === 'high'
                ? 'border-red-600 text-red-600 hover:border-red-700 hover:text-red-700'
                : 'border-gray-600 text-gray-600 hover:border-gray-700 hover:text-gray-700'
                } min-w-[100px]`}
            >
              <Phone className="w-4 h-4 mr-1" />
              {contact.number.split('/')[0].trim()}
            </Button>
          </div>
        ))}

        {/* Additional Info */}
        <div className="mt-4 p-3 border-2 border-amber-600 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>📱 Tip:</strong> Save these numbers in your phone for offline access.
            {profile === 'marine' && ' For maritime emergencies, use VHF Channel 16 for immediate assistance.'}
            {profile === 'mountain' && ' In mountains, cell coverage may be limited. Consider satellite communication devices.'}
          </p>
        </div>

        {/* Location coordinates for rescue services */}
        <div className="mt-2 p-2 border rounded text-xs">
          <strong>📍 Your coordinates for rescue services:</strong>
          <br />
          {coordinates ? (
            <>
              Latitude: {coordinates.latitude.toFixed(6)}
              <br />
              Longitude: {coordinates.longitude.toFixed(6)}
              <br />
              <em>Share these exact coordinates with emergency services for precise location.</em>
            </>
          ) : (
            <em>Location coordinates will appear here when available.</em>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
