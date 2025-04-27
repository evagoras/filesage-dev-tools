import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
import os

today = datetime.now().strftime('%Y_%m_%d')

def plot_text_files(df_text):
    plt.figure()
    plt.plot(df_text['size_kb'], df_text['string_time_ms'], label='String Compare', marker='o')
    plt.plot(df_text['size_kb'], df_text['buffer_time_ms'], label='Buffer Compare', marker='x')
    plt.plot(df_text['size_kb'], df_text['hash_time_ms'], label='Hash Compare', marker='s')
    plt.title('Performance on Text Files')
    plt.xlabel('File Size (KB)')
    plt.ylabel('Time (ms)')
    plt.legend()
    plt.grid(True)
    plt.savefig(f'plots/text_files_comparison_{today}.png')
    plt.show()

def plot_binary_files(df_binary):
    plt.figure()
    plt.plot(df_binary['size_kb'], df_binary['buffer_time_ms'], label='Buffer Compare', marker='x')
    plt.plot(df_binary['size_kb'], df_binary['hash_time_ms'], label='Hash Compare', marker='s')
    plt.title('Performance on Binary Files')
    plt.xlabel('File Size (KB)')
    plt.ylabel('Time (ms)')
    plt.legend()
    plt.grid(True)
    plt.savefig(f'plots/binary_files_comparison_{today}.png')
    plt.show()

def plot_local_vs_url_files(df_local_vs_url):
    plt.figure()
    x = df_local_vs_url['file_name']
    y1 = df_local_vs_url['buffer_compare_ms']
    y2 = df_local_vs_url['hash_compare_ms']

    plt.plot(x, y1, marker='o', label='Buffer Compare (ms)')
    plt.plot(x, y2, marker='s', label='Hash Compare (ms)')

    plt.title('Performance on Local vs URL Files')
    plt.xlabel('File Name')
    plt.ylabel('Comparison Time (ms)')
    plt.legend()
    plt.grid(True)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig(f'plots/local_vs_url_comparison_{today}.png')
    plt.show()

def main():
    text_files = [f for f in os.listdir('benchmarks') if f.startswith('text_file_benchmark')]
    binary_files = [f for f in os.listdir('benchmarks') if f.startswith('binary_file_benchmark')]
    local_vs_url_files = [f for f in os.listdir('benchmarks') if f.startswith('local_vs_url_benchmark')]

    if text_files:
        df_text = pd.read_csv(f'benchmarks/{text_files[-1]}')
        plot_text_files(df_text)

    if binary_files:
        df_binary = pd.read_csv(f'benchmarks/{binary_files[-1]}')
        plot_binary_files(df_binary)

    if local_vs_url_files:
        df_local_vs_url = pd.read_csv(f'benchmarks/{local_vs_url_files[-1]}')
        plot_local_vs_url_files(df_local_vs_url)

if __name__ == "__main__":
    main()
