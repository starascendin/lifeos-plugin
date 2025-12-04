import { useColor } from '@/hooks/useColor';
import { SearchProvider, useSearch } from '@/providers/search-context';
import { Stack } from 'expo-router';
import { DrawerToggleButton } from '@react-navigation/drawer';

function SearchLayoutContent() {
  const text = useColor('text');
  const background = useColor('background');
  const { setSearchText } = useSearch();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: text,
        headerStyle: { backgroundColor: background },
        headerLeft: () => <DrawerToggleButton tintColor={text} />,
      }}
    >
      <Stack.Screen
        name='index'
        options={{
          title: 'Search',
          headerSearchBarOptions: {
            placement: 'stacked',
            placeholder: 'Search',
            onChangeText: (event) => {
              setSearchText(event.nativeEvent.text);
            },
          },
        }}
      />
    </Stack>
  );
}

export default function SearchLayout() {
  return (
    <SearchProvider>
      <SearchLayoutContent />
    </SearchProvider>
  );
}
