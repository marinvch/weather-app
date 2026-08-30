import { Users, Anchor, Mountain, Wheat } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setProfile } from '@/store/slices/userProfileSlice';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import type { UserProfile } from '@/shared/types/weather';

const profileConfig = {
  general: {
    label: 'General Public',
    description: 'Basic weather forecast for daily activities',
    icon: Users,
    color: 'text-blue-600',
  },
  marine: {
    label: 'Marine & Fishing',
    description: 'Sea conditions, waves, tides, and marine weather',
    icon: Anchor,
    color: 'text-cyan-600',
  },
  mountain: {
    label: 'Mountaineering',
    description: 'High-altitude weather, avalanche risk, mountain conditions',
    icon: Mountain,
    color: 'text-green-600',
  },
  agriculture: {
    label: 'Agriculture',
    description: 'Soil conditions, frost risk, farming weather data',
    icon: Wheat,
    color: 'text-yellow-600',
  },
} as const;

export function ProfileSelector() {
  const dispatch = useAppDispatch();
  const currentProfile = useAppSelector((state) => state.userProfile.profile);

  const handleProfileChange = (profile: UserProfile) => {
    dispatch(setProfile(profile));
  };

  return (
    <div className="w-full max-w-sm">
      <Select value={currentProfile} onValueChange={handleProfileChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <div className="flex items-center gap-2">
              {(() => {
                const config = profileConfig[currentProfile];
                const Icon = config.icon;
                return (
                  <>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span>{config.label}</span>
                  </>
                );
              })()}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(profileConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <SelectItem key={key} value={key}>
                <div className="flex items-start gap-3 py-1">
                  <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                  <div className="flex flex-col">
                    <span className="font-medium">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {config.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
