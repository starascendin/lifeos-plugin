import { useState } from 'react';
import { Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAppStore } from '../../../store/appStore';
import { LLM_CONFIG, LLM_PROVIDERS, type LLMType, type Tier } from '../../../config/llm';
import { ScreenHeader } from '../common/ScreenHeader';
import { XaiSettings } from '../../Sidebar/XaiSettings';

export function SettingsScreen() {
  const currentTier = useAppStore((state) => state.currentTier);
  const setTier = useAppStore((state) => state.setTier);
  const authStatus = useAppStore((state) => state.authStatus);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader title="Settings" />

      <ScrollArea className="flex-1 p-4">
        {/* Tier Selector */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Model Tier</CardTitle>
            <CardDescription>Select quality level for all models</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="single"
              value={currentTier}
              onValueChange={(value) => value && setTier(value as Tier)}
              className="w-full"
            >
              <ToggleGroupItem value="mini" className="flex-1">
                Mini
              </ToggleGroupItem>
              <ToggleGroupItem value="normal" className="flex-1">
                Normal
              </ToggleGroupItem>
              <ToggleGroupItem value="pro" className="flex-1">
                Pro
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground mt-2">
              Mini = Fast & cheap | Normal = Balanced | Pro = Best quality
            </p>
          </CardContent>
        </Card>

        {/* LLM Status */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">LLM Status</CardTitle>
            <CardDescription>Connection status for each provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {LLM_PROVIDERS.map((llm: LLMType) => {
                const config = LLM_CONFIG[llm];
                const isOnline = authStatus[llm];

                return (
                  <div key={llm} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-lg font-bold w-6 text-center"
                        style={{ color: config.color }}
                      >
                        {config.icon}
                      </span>
                      <span className="font-medium">{config.name}</span>
                    </div>
                    <Badge variant={isOnline ? "default" : "secondary"}>
                      {isOnline ? "Online" : "Offline"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* API Key Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vercel AI Gateway</CardTitle>
            <CardDescription>Configure Grok API access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowApiKeyModal(true)}
            >
              <Key className="h-4 w-4 mr-2" />
              Configure API Key
            </Button>
          </CardContent>
        </Card>
      </ScrollArea>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <XaiSettings onClose={() => setShowApiKeyModal(false)} />
      )}
    </div>
  );
}
