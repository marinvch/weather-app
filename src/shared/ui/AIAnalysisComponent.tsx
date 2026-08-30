import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { AlertTriangle, CheckCircle, Info, Lightbulb } from 'lucide-react';
import type { AIAnalysis, MarineAnalysis, MountainAnalysis, AgriculturalAnalysis } from '@/shared/types/weather';

interface AIAnalysisComponentProps {
  analysis: AIAnalysis | MarineAnalysis | MountainAnalysis | AgriculturalAnalysis;
  className?: string;
}

export function AIAnalysisComponent({ analysis, className }: AIAnalysisComponentProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'border-2 border-green-600 text-green-800';
      case 'medium': return 'border-2 border-yellow-600 text-yellow-800';
      case 'high': return 'border-2 border-red-600 text-red-800';
      default: return 'border-2 border-gray-600 text-gray-800';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-4 h-4" />;
      case 'medium': return <Info className="w-4 h-4" />;
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadgeClass = (condition: string, goodValues: string[], excellentValues: string[] = []) => {
    if (excellentValues.includes(condition)) return 'border-2 border-green-600 text-green-800';
    if (goodValues.includes(condition)) return 'border-2 border-gray-600 text-gray-800';
    return 'border-2 border-red-600 text-red-800';
  };

  // Type-specific information
  const renderSpecificInfo = () => {
    if ('fishingConditions' in analysis) {
      const marineAnalysis = analysis as MarineAnalysis;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Fishing Conditions:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadgeClass(marineAnalysis.fishingConditions, ['good'], ['excellent'])
              }`}>
              {marineAnalysis.fishingConditions}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sea State:</span>
            <span className="text-sm">{marineAnalysis.seaState}</span>
          </div>
          {marineAnalysis.tideRecommendation && (
            <div className="text-sm border p-2 rounded">
              <strong>Tide Info:</strong> {marineAnalysis.tideRecommendation}
            </div>
          )}
          <div className="text-sm text-gray-600">
            <strong>Wave Analysis:</strong> {marineAnalysis.waveAnalysis}
          </div>
        </div>
      );
    }

    if ('avalancheRisk' in analysis) {
      const mountainAnalysis = analysis as MountainAnalysis;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Avalanche Risk:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadgeClass(mountainAnalysis.avalancheRisk, ['low'], [])
              }`}>
              {mountainAnalysis.avalancheRisk}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Wind Exposure:</span>
            <span className="text-sm">{mountainAnalysis.windExposure}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Visibility:</span>
            <span className="text-sm">{mountainAnalysis.visibilityForecast}</span>
          </div>
          <div className="text-sm text-gray-600">
            <strong>Temperature Gradient:</strong> {mountainAnalysis.temperatureGradient}
          </div>
        </div>
      );
    }

    if ('soilConditions' in analysis) {
      const agriAnalysis = analysis as AgriculturalAnalysis;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Soil Conditions:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadgeClass(agriAnalysis.soilConditions, ['good'], ['excellent'])
              }`}>
              {agriAnalysis.soilConditions}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Frost Risk:</span>
            <span className={`px-2 py-1 rounded text-sm font-medium ${getStatusBadgeClass(agriAnalysis.frostRisk, [], ['none'])
              }`}>
              {agriAnalysis.frostRisk}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Irrigation Needed:</span>
            <span className={`text-sm ${agriAnalysis.irrigationNeeded ? 'text-orange-600' : 'text-green-600'}`}>
              {agriAnalysis.irrigationNeeded ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            <strong>Planting Conditions:</strong> {agriAnalysis.plantingConditions}
          </div>
          {agriAnalysis.harvestRecommendation && (
            <div className="text-sm text-green-600 border-2 border-green-600 p-2 rounded">
              <strong>Harvest:</strong> {agriAnalysis.harvestRecommendation}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          AI Analysis & Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Risk Level:</span>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getRiskColor(analysis.riskLevel)}`}>
            {getRiskIcon(analysis.riskLevel)}
            <span className="text-sm font-medium capitalize">{analysis.riskLevel}</span>
          </div>
        </div>

        {/* Confidence Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Confidence:</span>
          <span className={`text-sm font-semibold ${getConfidenceColor(analysis.confidence)}`}>
            {analysis.confidence}%
          </span>
        </div>

        {/* Main Recommendation */}
        <div className="p-3 border rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-foreground mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium mb-1">Recommendation</h4>
              <p className="text-sm text-muted-foreground">{analysis.recommendation}</p>
            </div>
          </div>
        </div>

        {/* Best Time for Activity */}
        {analysis.bestTimeForActivity && (
          <div className="text-sm">
            <strong>Best Time:</strong> {analysis.bestTimeForActivity}
          </div>
        )}

        {/* Profile-Specific Information */}
        {renderSpecificInfo()}

        {/* Reasoning */}
        <div className="text-xs text-gray-500 border-t pt-3">
          <strong>Analysis based on:</strong> {analysis.reasoning}
        </div>

        {/* Tips */}
        {analysis.profileSpecificTips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Tips & Recommendations:</h4>
            <ul className="space-y-1">
              {analysis.profileSpecificTips.map((tip, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 border border-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
