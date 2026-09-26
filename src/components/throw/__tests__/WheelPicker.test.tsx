import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithSafeArea } from '../../../testUtils/renderWithSafeArea';
import { WheelPicker } from '../WheelPicker';

function Wrapper({ items, initial }: { items: string[]; initial: number }) {
  const [index, setIndex] = React.useState(initial);
  return <WheelPicker items={items} selectedIndex={index} onChange={setIndex} accessibilityLabel="Test" />;
}

describe('WheelPicker', () => {
  it('renders every item, scoped by its column label', async () => {
    await renderWithSafeArea(<Wrapper items={['A', 'B', 'C']} initial={0} />);
    expect(screen.getByLabelText('Test A')).toBeTruthy();
    expect(screen.getByLabelText('Test B')).toBeTruthy();
    expect(screen.getByLabelText('Test C')).toBeTruthy();
  });

  it('calls onChange with the tapped item\'s index', async () => {
    const onChange = jest.fn();
    await renderWithSafeArea(<WheelPicker items={['A', 'B', 'C']} selectedIndex={0} onChange={onChange} accessibilityLabel="Test" />);
    await fireEvent.press(screen.getByLabelText('Test C'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('does not call onChange when tapping the already-selected item', async () => {
    const onChange = jest.fn();
    await renderWithSafeArea(<WheelPicker items={['A', 'B', 'C']} selectedIndex={1} onChange={onChange} accessibilityLabel="Test" />);
    await fireEvent.press(screen.getByLabelText('Test B'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
