import pandas as pd

def clean_airport_csv(file_path, output_path):
    try:
        data = pd.read_csv(file_path)
        print("Original Data:")
        print(data.head())

        if 'Source airport' in data.columns and 'Destination airport' in data.columns:
            data = data[(data['Source airport'] != '\\N') & (data['Destination airport'] != '\\N')]
            print("\nAfter removing rows with 'Source airport' or 'Destination airport' value as '\\N':")
            print(data.head())
        else:
            print("\nRequired columns 'Source airport' or 'Destination airport' not found in the dataset.")

        data = data.drop_duplicates(subset=['Source airport', 'Destination airport'])
        print("\nAfter removing rows with duplicate Source and Destination airport pairs:")
        print(data.head())

        columns_to_drop = ['Airline', 'Airline ID', 'Codeshare', 'Stops', 'Equipment']
        data = data.drop(columns=columns_to_drop, errors='ignore')
        print("\nAfter dropping specified columns:")
        print(data.head())

        data.to_csv(output_path, index=False)
        print(f"\nCleaned data saved to {output_path}")

    except Exception as e:
        print(f"Error: {e}")

clean_airport_csv('data/routes.csv', 'cleaned_second_file.csv')
