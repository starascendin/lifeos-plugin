import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { VocabBankList } from '@/components/vocab/VocabBankList';

export default function VocabBankScreen() {
  const background = useColor('background');

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <VocabBankList />
    </View>
  );
}
